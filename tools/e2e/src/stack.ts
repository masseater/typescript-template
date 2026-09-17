import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Browser } from "./browser.ts";
import {
  ensure,
  grafana,
  json,
  mailpit,
  object,
  poll,
  root,
  run,
  shellQuote,
  string,
} from "./support.ts";

async function prerequisites() {
  const checks = [
    ["Mailpit:8025", () => json(`${mailpit}/api/v1/info`)],
    ["Grafana:3100", () => json(`${grafana}/api/health`)],
    [
      "OTLP:4318",
      () =>
        json("http://127.0.0.1:4318/v1/traces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"resourceSpans":[]}',
        }),
    ],
  ] as const;
  const results = await Promise.allSettled(checks.map(([, check]) => check()));
  const missing = checks
    .filter((_, index) => results[index]?.status === "rejected")
    .map(([name]) => name);
  ensure(
    missing.length === 0,
    `E2E_DEPENDENCIES_UNAVAILABLE: ${missing.join(", ")}. Start the real local services; E2E cannot be skipped or mocked.`,
  );
  ensure(
    (await run("agent-browser", ["--version"])).trim() === "agent-browser 0.37.1",
    "E2E_REQUIRES_AGENT_BROWSER_0.37.1",
  );
  await run("tmux", ["-V"]);
}

async function reservePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  ensure(address && typeof address === "object", "E2E_PORT_ALLOCATION_FAILED");
  return {
    port: address.port,
    close: () => {
      if (!server.listening) return Promise.resolve();
      return new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export async function createStack() {
  await prerequisites();
  const local = path.join(root, ".local");
  await mkdir(local, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(local, "e2e-"));
  await chmod(directory, 0o700);
  const id = path.basename(directory);
  const sessions = new Set<string>();
  const browsers = new Set<Browser>();
  const messages = new Set<string>();
  const registrations = new Set<string>();
  const ports: Awaited<ReturnType<typeof reservePort>>[] = [];
  let userOrigin = "";
  let adminOrigin = "";
  const basicUser = `gate-${id}`;
  const basicPassword = randomBytes(32).toString("base64url");
  const authSecret = randomBytes(48).toString("base64url");
  const databaseId = randomUUID();
  const persist = path.join(directory, "d1");
  const configs: Record<string, string> = {};

  async function stopUser() {
    const session = `${id}-user`;
    if (sessions.has(session)) {
      await run("tmux", ["kill-session", "-t", session]);
      sessions.delete(session);
    }
    await poll(
      async () => {
        try {
          await fetch(`${userOrigin}/login`, { signal: AbortSignal.timeout(500) });
          return false;
        } catch {
          return true;
        }
      },
      (closed) => closed,
      "E2E_USER_WORKER_DID_NOT_STOP",
      10_000,
    );
  }

  async function cleanup() {
    const errors: string[] = [];
    for (const browser of browsers) {
      try {
        await browser.close();
      } catch {
        errors.push("browser");
      }
    }
    for (const session of sessions) {
      try {
        await run("tmux", ["kill-session", "-t", session]);
      } catch {
        errors.push("worker-exited");
      }
    }
    await mkdir(path.join(local, "logs"), { recursive: true, mode: 0o700 });
    for (const audience of ["user", "admin"]) {
      const target = path.join(local, "logs", `e2e-last-${audience}.log`);
      await rm(target, { force: true });
      await copyFile(path.join(directory, `${audience}.log`), target).then(
        () => chmod(target, 0o600),
        () => undefined,
      );
    }
    for (const email of registrations) {
      try {
        const result = object(
          await json(
            `${mailpit}/api/v1/search?${new URLSearchParams({ query: `to:${email}`, limit: "100" }).toString()}`,
          ),
        );
        const entries = result["messages"];
        if (Array.isArray(entries))
          for (const entry of entries) {
            const message = object(entry);
            const recipients = message["To"];
            if (
              Array.isArray(recipients) &&
              recipients.some((recipient: unknown) => object(recipient)["Address"] === email)
            )
              messages.add(string(message["ID"]));
          }
      } catch {
        errors.push("mail-search");
      }
    }
    if (messages.size > 0) {
      try {
        const response = await fetch(`${mailpit}/api/v1/messages`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: [...messages] }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) errors.push("mail-delete");
      } catch {
        errors.push("mail-delete");
      }
    }
    for (const port of ports) {
      try {
        await port.close();
      } catch {
        errors.push("port-reservation");
      }
    }
    ensure(
      path.dirname(directory) === local && path.basename(directory).startsWith("e2e-"),
      "E2E_UNSAFE_CLEANUP_PATH",
    );
    await rm(directory, { recursive: true, force: false });
    ensure(errors.length === 0, `E2E_CLEANUP_FAILED: ${[...new Set(errors)].join(",")}`);
  }

  try {
    const browserConfig = path.join(directory, "agent-browser.json");
    await writeFile(browserConfig, "{}", { mode: 0o600 });
    ports.push(await reservePort());
    ports.push(await reservePort());
    const userPort = ports[0];
    const adminPort = ports[1];
    ensure(userPort && adminPort, "E2E_PORT_ALLOCATION_FAILED");
    userOrigin = `http://localhost:${userPort.port}`;
    adminOrigin = `http://localhost:${adminPort.port}`;
    const require = createRequire(import.meta.url);
    const wrangler = path.join(
      path.dirname(require.resolve("wrangler/package.json")),
      "bin/wrangler.js",
    );
    for (const [audience, origin, reservation] of [
      ["user", userOrigin, userPort],
      ["admin", adminOrigin, adminPort],
    ] as const) {
      const builtDirectory = path.join(root, "apps", audience, "dist");
      const built = object(
        JSON.parse(
          await readFile(path.join(builtDirectory, "server/wrangler.json"), "utf8"),
        ) as unknown,
      );
      const entry = path.resolve(builtDirectory, "server", string(built["main"]));
      ensure(entry.startsWith(`${builtDirectory}${path.sep}`), "E2E_WORKER_ENTRY_OUTSIDE_BUILD");
      await access(entry);
      await access(path.join(builtDirectory, "client"));
      const config = path.join(directory, `${audience}.json`);
      const envFile = path.join(directory, `${audience}.env`);
      configs[audience] = config;
      await writeFile(
        config,
        JSON.stringify({
          name: `${id.toLowerCase()}-${audience}`,
          main: entry,
          compatibility_date: built["compatibility_date"],
          compatibility_flags: built["compatibility_flags"],
          rules: built["rules"],
          no_bundle: true,
          assets: {
            directory: path.join(builtDirectory, "client"),
            binding: "ASSETS",
            run_worker_first: true,
          },
          d1_databases: [
            {
              binding: "DB",
              database_name: `${id}-shared`,
              database_id: databaseId,
              migrations_dir: path.join(root, "libs/db/migrations"),
            },
          ],
          vars: {},
          workers_dev: false,
          preview_urls: false,
        }),
        { mode: 0o600 },
      );
      await writeFile(
        envFile,
        [
          `APP_ORIGIN=${origin}`,
          `AUTH_SECRET=${authSecret}`,
          "OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318",
          "EMAIL_FROM=e2e@example.test",
          `MAILPIT_URL=${mailpit}`,
          ...(audience === "admin"
            ? [`LOCAL_ADMIN_USER=${basicUser}`, `LOCAL_ADMIN_PASSWORD=${basicPassword}`]
            : []),
          "",
        ].join("\n"),
        { mode: 0o600 },
      );
      const launch = path.join(directory, `${audience}.fish`);
      await writeFile(
        launch,
        `set -x X_LOCAL_EXPLORER false\nexec ${shellQuote(process.execPath)} ${shellQuote(wrangler)} dev --local --config ${shellQuote(config)} --env-file ${shellQuote(envFile)} --persist-to ${shellQuote(persist)} --ip localhost --port ${reservation.port} --inspector-port 0 --show-interactive-dev-session=false >${shellQuote(path.join(directory, `${audience}.log`))} 2>&1\n`,
        { mode: 0o600 },
      );
    }
    const userConfig = configs["user"];
    ensure(userConfig, "E2E_USER_CONFIG_MISSING");
    await run(
      process.execPath,
      [
        wrangler,
        "d1",
        "migrations",
        "apply",
        "DB",
        "--local",
        "--config",
        userConfig,
        "--persist-to",
        persist,
      ],
      "",
      120_000,
    );
    for (const [audience, reservation, origin, ready] of [
      ["user", userPort, userOrigin, 200],
      ["admin", adminPort, adminOrigin, 401],
    ] as const) {
      await reservation.close();
      const session = `${id}-${audience}`;
      await run("tmux", [
        "new-session",
        "-d",
        "-s",
        session,
        "-c",
        directory,
        `/opt/homebrew/bin/fish ${shellQuote(path.join(directory, `${audience}.fish`))}`,
      ]);
      sessions.add(session);
      await poll(
        async () => {
          try {
            return (await fetch(`${origin}/login`, { signal: AbortSignal.timeout(2000) })).status;
          } catch {
            return 0;
          }
        },
        (status) => status === ready,
        "E2E_WORKER_STARTUP_FAILED",
        90_000,
      );
    }
    const browser = (name: string) => {
      const value = new Browser(`${id}-${name}`, browserConfig);
      browsers.add(value);
      return value;
    };
    const bootstrap = async (email: string) => {
      await run(
        process.execPath,
        [fileURLToPath(new URL("bootstrap.ts", import.meta.url))],
        JSON.stringify({ config: userConfig, persist: path.join(persist, "v3"), email }),
      );
    };
    const account = (name: string) => {
      const email = `${id.toLowerCase()}-${name}@example.test`;
      registrations.add(email);
      return { email, password: randomBytes(32).toString("base64url"), name: `E2E ${name}` };
    };
    return {
      userOrigin,
      adminOrigin,
      basicUser,
      basicPassword,
      account,
      browser,
      bootstrap,
      stopUser,
      cleanup,
      messages,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new Error(
        `${error instanceof Error ? error.message : "E2E_STACK_FAILED"}; ${cleanupError instanceof Error ? cleanupError.message : "E2E_CLEANUP_FAILED"}`,
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

export type Stack = Awaited<ReturnType<typeof createStack>>;
