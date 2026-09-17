import { access, readFile, writeFile } from "node:fs/promises";
import {
  ensure,
  mailpit,
  object,
  poll,
  privateFileMode,
  root,
  run,
  shellQuote,
  string,
} from "./support.ts";
import { httpStatus, requestTimeout } from "./http.ts";
import type { Service } from "./observation.ts";
import type { StackResourcesHandle } from "./stack-resources.ts";
import { createServer } from "node:net";
import { once } from "node:events";
import path from "node:path";

interface PortReservation {
  readonly close: () => Promise<void>;
  readonly port: number;
}

interface WorkerTarget {
  readonly audience: Service;
  readonly origin: string;
  readonly reservation: PortReservation;
}

interface StackSettings {
  readonly authSecret: string;
  readonly basicPassword: string;
  readonly basicUser: string;
  readonly browserConfig: string;
  readonly databaseId: string;
  readonly directory: string;
  readonly id: string;
  readonly persist: string;
  readonly wrangler: string;
}

interface BuiltWorker {
  readonly clientDirectory: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly entry: string;
}

const migrationTimeout = 120_000;
const workerStartupTimeout = 90_000;
const workerStopTimeout = 10_000;
const unreachableStatus = 0;
const readiness: Readonly<Record<Service, Readonly<{ path: string; status: number }>>> = {
  admin: { path: "/login", status: httpStatus.unauthorized },
  user: { path: "/login", status: httpStatus.ok },
  wiki: { path: "/", status: httpStatus.ok },
};

async function reservePort(): Promise<PortReservation> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  ensure(address !== null && typeof address === "object", "E2E_PORT_ALLOCATION_FAILED");
  return {
    close: async (): Promise<void> => {
      if (server.listening) {
        server.close();
        await once(server, "close");
      }
    },
    port: address.port,
  };
}

function workerFile(settings: StackSettings, audience: Service, extension: string): string {
  return path.join(settings.directory, `${audience}.${extension}`);
}

function workerConfigPath(settings: StackSettings, audience: Service): string {
  return workerFile(settings, audience, "json");
}

async function builtWorker(audience: Service): Promise<BuiltWorker> {
  const builtDirectory = path.join(root, "apps", audience, "dist");
  const source = await readFile(path.join(builtDirectory, "server/wrangler.json"), "utf-8");
  const config = object(JSON.parse(source) as unknown);
  const entry = path.resolve(builtDirectory, "server", string(config["main"]));
  ensure(entry.startsWith(`${builtDirectory}${path.sep}`), "E2E_WORKER_ENTRY_OUTSIDE_BUILD");
  const clientDirectory = path.join(builtDirectory, "client");
  await access(entry);
  await access(clientDirectory);
  return { clientDirectory, config, entry };
}

function workerConfig(settings: StackSettings, audience: Service, built: BuiltWorker): string {
  return JSON.stringify({
    assets: { binding: "ASSETS", directory: built.clientDirectory, run_worker_first: true },
    compatibility_date: built.config["compatibility_date"],
    compatibility_flags: built.config["compatibility_flags"],
    d1_databases:
      audience === "wiki"
        ? []
        : [
            {
              binding: "DB",
              database_id: settings.databaseId,
              database_name: `${settings.id}-shared`,
              migrations_dir: path.join(root, "libs/db/migrations"),
            },
          ],
    main: built.entry,
    name: `${settings.id.toLowerCase()}-${audience}`,
    no_bundle: true,
    preview_urls: false,
    rules: built.config["rules"],
    vars: {},
    workers_dev: false,
  });
}

function workerEnvironment(settings: StackSettings, target: WorkerTarget): string {
  const applicationVariables =
    target.audience === "wiki"
      ? []
      : [
          `AUTH_SECRET=${settings.authSecret}`,
          "EMAIL_FROM=e2e@example.test",
          `MAILPIT_URL=${mailpit}`,
        ];
  const adminVariables =
    target.audience === "admin"
      ? [`LOCAL_ADMIN_USER=${settings.basicUser}`, `LOCAL_ADMIN_PASSWORD=${settings.basicPassword}`]
      : [];
  return [
    `APP_ORIGIN=${target.origin}`,
    "OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318",
    ...applicationVariables,
    ...adminVariables,
    "",
  ].join("\n");
}

function launchScript(settings: StackSettings, target: WorkerTarget): string {
  const config = shellQuote(workerFile(settings, target.audience, "json"));
  const environment = shellQuote(workerFile(settings, target.audience, "env"));
  const log = shellQuote(workerFile(settings, target.audience, "log"));
  return `set -x X_LOCAL_EXPLORER false\nexec ${shellQuote(process.execPath)} ${shellQuote(settings.wrangler)} dev --local --config ${config} --env-file ${environment} --persist-to ${shellQuote(settings.persist)} --ip localhost --port ${target.reservation.port} --inspector-port 0 --show-interactive-dev-session=false >${log} 2>&1\n`;
}

async function writeWorkerFiles(settings: StackSettings, target: WorkerTarget): Promise<void> {
  const built = await builtWorker(target.audience);
  await Promise.all([
    writeFile(
      workerConfigPath(settings, target.audience),
      workerConfig(settings, target.audience, built),
      {
        mode: privateFileMode,
      },
    ),
    writeFile(workerFile(settings, target.audience, "env"), workerEnvironment(settings, target), {
      mode: privateFileMode,
    }),
    writeFile(workerFile(settings, target.audience, "fish"), launchScript(settings, target), {
      mode: privateFileMode,
    }),
  ]);
}

async function migrateDatabase(settings: StackSettings): Promise<void> {
  await run(
    process.execPath,
    [
      settings.wrangler,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      workerConfigPath(settings, "user"),
      "--persist-to",
      settings.persist,
    ],
    { timeout: migrationTimeout },
  );
}

async function readinessStatus(url: string): Promise<number> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeout.readiness) });
    return response.status;
  } catch {
    return unreachableStatus;
  }
}

async function startWorker(
  settings: StackSettings,
  resources: StackResourcesHandle,
  target: WorkerTarget,
): Promise<void> {
  await target.reservation.close();
  const session = `${settings.id}-${target.audience}`;
  await run("tmux", [
    "new-session",
    "-d",
    "-s",
    session,
    "-c",
    settings.directory,
    `/opt/homebrew/bin/fish ${shellQuote(workerFile(settings, target.audience, "fish"))}`,
  ]);
  resources.addSession(session);
  const { path: readyPath, status } = readiness[target.audience];
  await poll({
    accept: (current) => current === status,
    code: "E2E_WORKER_STARTUP_FAILED",
    read: async () => readinessStatus(`${target.origin}${readyPath}`),
    timeout: workerStartupTimeout,
  });
}

async function workerStopped(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(requestTimeout.probe) });
    return false;
  } catch {
    return true;
  }
}

async function stopWorker(
  settings: StackSettings,
  resources: StackResourcesHandle,
  target: Readonly<{ audience: Service; origin: string }>,
): Promise<void> {
  await resources.killSession(`${settings.id}-${target.audience}`);
  await poll({
    accept: (closed) => closed,
    code: "E2E_USER_WORKER_DID_NOT_STOP",
    read: async () => workerStopped(`${target.origin}/login`),
    timeout: workerStopTimeout,
  });
}

export {
  migrateDatabase,
  reservePort,
  startWorker,
  stopWorker,
  workerConfigPath,
  writeWorkerFiles,
};
export type { StackSettings, WorkerTarget };
