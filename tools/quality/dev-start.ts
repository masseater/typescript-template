// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { access } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as delay } from "node:timers/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { createServer } from "vite-plus";

import { applications } from "@repo/config";
import type { Application } from "@repo/config";

interface Probed {
  readonly attempts: number;
  readonly unexpected: string;
}
interface Probes {
  readonly retried: string[];
  readonly unexpected: string[];
}

// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const vp = path.join(root, "node_modules/.bin/vp");
const probePaths: readonly string[] = ["/", "/api/health"];
const responseTimeoutMilliseconds = 120_000;
const preparationTimeoutMilliseconds = 300_000;
const readinessTimeoutMilliseconds = 15_000;
const readinessIntervalMilliseconds = 500;
const firstFailingStatus = 400;

function appRoot(app: Application): string {
  return path.join(root, "apps", app);
}

async function missing(file: string): Promise<boolean> {
  try {
    await access(file);
    return false;
  } catch {
    return true;
  }
}

async function runTask(workspace: string, task: string): Promise<void> {
  await execFileAsync(vp, ["run", "--filter", workspace, task], {
    cwd: root,
    timeout: preparationTimeoutMilliseconds,
  });
}

async function prepare(): Promise<void> {
  const variables = await Promise.all(
    applications.map(async (app) => missing(path.join(appRoot(app), ".dev.vars"))),
  );
  if (variables.includes(true)) {
    await runTask("@repo/dev", "setup");
  }
  await runTask("@repo/db", "db:migrate:local");
}

async function answer(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(responseTimeoutMilliseconds),
    });
    await response.body?.cancel();
    return response.status < firstFailingStatus ? "" : `responded ${response.status}`;
  } catch (error: unknown) {
    return `did not answer: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function probe(origin: string, pathname: string): Promise<Probed> {
  const deadline = Date.now() + readinessTimeoutMilliseconds;
  let unexpected = await answer(`${origin}${pathname}`);
  let attempts = 1;
  while (unexpected !== "" && Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop
    await delay(readinessIntervalMilliseconds);
    // oxlint-disable-next-line no-await-in-loop
    unexpected = await answer(`${origin}${pathname}`);
    attempts += 1;
  }
  return { attempts, unexpected };
}

async function probeAll(app: Application, origin: string): Promise<Probes> {
  const probes: Probes = { retried: [], unexpected: [] };
  for (const pathname of probePaths) {
    // oxlint-disable-next-line no-await-in-loop
    const { attempts, unexpected } = await probe(origin, pathname);
    if (attempts > 1) {
      probes.retried.push(`${app}${pathname} answered after ${attempts} attempts`);
    }
    if (unexpected !== "") {
      probes.unexpected.push(`${app}${pathname} ${unexpected}`);
    }
  }
  return probes;
}

async function serve(app: Application): Promise<Probes> {
  process.chdir(appRoot(app));
  const server = await createServer({
    configFile: path.join(appRoot(app), "vite.config.ts"),
    logLevel: "silent",
    root: appRoot(app),
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (typeof address !== "object" || address === null) {
      return { retried: [], unexpected: [`${app} did not listen`] };
    }
    return await probeAll(app, `http://127.0.0.1:${address.port}`);
  } finally {
    await server.close();
  }
}

async function start(app: Application): Promise<Probes> {
  try {
    return await serve(app);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return { retried: [], unexpected: [`${app} failed to start: ${reason}`] };
  }
}

await prepare();

const started: Probes = { retried: [], unexpected: [] };
for (const app of applications) {
  // oxlint-disable-next-line no-await-in-loop
  const probes = await start(app);
  started.retried.push(...probes.retried);
  started.unexpected.push(...probes.unexpected);
}

// oxlint-disable-next-line eslint/no-restricted-properties
process.stdout.write(
  `${JSON.stringify({
    event: "quality.dev_start",
    ok: started.unexpected.length === 0,
    probes: applications.length * probePaths.length,
    ...started,
  })}\n`,
);
if (started.unexpected.length > 0) {
  process.exitCode = 1;
}
