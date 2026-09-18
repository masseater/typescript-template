// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { createServer } from "vite-plus";

import type { Application } from "@repo/config";

import { loopback } from "./ports.ts";
import { applicationRoot } from "./repository.ts";
import { deadlineIn, until } from "./waiting.ts";

const readyTimeout = 300_000;
const requestTimeout = 120_000;
const okStatus = 200;
const healthPath = "/api/health";

type DevServer = Awaited<ReturnType<typeof createServer>>;

async function startApplication(application: Application, port: number): Promise<DevServer> {
  const root = applicationRoot(application);
  const server = await createServer({
    configFile: path.join(root, "vite.config.ts"),
    logLevel: "silent",
    root,
    server: { host: loopback, port, strictPort: true },
  });
  await server.listen();
  return server;
}

async function answered(origin: string): Promise<readonly number[]> {
  try {
    const response = await fetch(new URL(healthPath, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeout),
    });
    await response.body?.cancel();
    return [response.status];
  } catch {
    return [];
  }
}

async function waitUntilReady(origin: string): Promise<void> {
  await until(
    async () => {
      const statuses = await answered(origin);
      return statuses.includes(okStatus) || undefined;
    },
    deadlineIn(readyTimeout),
    "E2E_APPLICATION_NOT_READY",
  );
}

export { startApplication, waitUntilReady };
export type { DevServer };
