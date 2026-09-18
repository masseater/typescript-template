// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { open } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { Application } from "@repo/config";

import { healthy, logTail } from "./app-health.ts";
import type { Environment } from "./local-database.ts";
import { loopback, loopbackOrigin } from "./ports.ts";
import { stopGroup } from "./process-group.ts";
import { applicationRoot, packageRoot } from "./repository.ts";
import { deadlineIn, until } from "./waiting.ts";

const readyTimeout = 300_000;
const startAttempts = 3;
const vitePlus = packageRoot("node_modules/.bin/vp");

interface ApplicationServer {
  readonly application: Application;
  readonly environment: Environment;
  readonly logDirectory: string;
  readonly port: number;
}

interface RunningApplication {
  readonly stop: () => Promise<void>;
  readonly waitUntilReady: () => Promise<void>;
}

interface ServedApplication {
  readonly stop: () => Promise<void>;
}

async function reachHealth(alive: () => boolean, origin: string, log: string): Promise<void> {
  try {
    await until(
      async () => {
        if (!alive()) {
          throw new Error("E2E_APPLICATION_STOPPED");
        }
        return (await healthy(origin)) || undefined;
      },
      deadlineIn(readyTimeout),
      "E2E_APPLICATION_NOT_READY",
    );
  } catch (error) {
    throw new Error(`E2E_APPLICATION_UNAVAILABLE ${await logTail(log)}`, { cause: error });
  }
}

async function startApplication(server: ApplicationServer): Promise<RunningApplication> {
  const { application, environment, logDirectory, port } = server;
  const log = path.join(logDirectory, `${application}.log`);
  const handle = await open(log, "a");
  const origin = loopbackOrigin(port);
  const args = ["dev", "--host", loopback, "--port", String(port), "--strictPort"];
  const child = spawn(vitePlus, args, {
    cwd: applicationRoot(application),
    detached: true,
    env: environment,
    stdio: ["ignore", handle.fd, handle.fd],
  });
  child.on("error", () => {
    child.kill("SIGKILL");
  });
  return {
    stop: async () => {
      await stopGroup(child);
      await handle.close();
    },
    waitUntilReady: async () =>
      reachHealth(() => child.exitCode === null && child.signalCode === null, origin, log),
  };
}

async function serveApplication(
  server: ApplicationServer,
  attempt = 1,
): Promise<ServedApplication> {
  const running = await startApplication(server);
  try {
    await running.waitUntilReady();
    return running;
  } catch (error) {
    await running.stop();
    if (attempt >= startAttempts) {
      throw error;
    }
    return serveApplication(server, attempt + 1);
  }
}

export { serveApplication };
