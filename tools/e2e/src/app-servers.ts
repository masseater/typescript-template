import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import path from "node:path";

import { healthReport, logTail, servingHealth } from "./app-health.ts";
import { loopback, loopbackOrigin } from "./ports.ts";
import { stopGroup } from "./process-group.ts";
import { applicationRoot, vitePlus } from "./repository.ts";
import { deadlineIn, until } from "./waiting.ts";

import type { Application } from "@repo/config";
import type { Environment } from "./local-database.ts";

const readyTimeout = 300_000;

const reachHealth = async (served: {
  readonly alive: () => boolean;
  readonly log: string;
  readonly origin: string;
}): Promise<void> => {
  try {
    await until({
      attempt: async () => {
        if (!served.alive()) {
          throw new Error("E2E_APPLICATION_STOPPED");
        }
        return (await healthReport(served.origin)) === servingHealth || undefined;
      },
      deadline: deadlineIn(readyTimeout),
      reason: "E2E_APPLICATION_NOT_READY",
    });
  } catch (unavailable) {
    throw new Error(`E2E_APPLICATION_UNAVAILABLE ${await logTail(served.log)}`, {
      cause: unavailable,
    });
  }
};

type ApplicationServer = {
  readonly application: Application;
  readonly environment: Environment;
  readonly logDirectory: string;
  readonly port: number;
};

const startApplication = async (
  server: ApplicationServer,
): Promise<{
  readonly stop: () => Promise<void>;
  readonly waitUntilReady: () => Promise<void>;
}> => {
  const { application, environment, logDirectory, port } = server;
  const log = path.join(logDirectory, `${application}.log`);
  const handle = await open(log, "a");
  const origin = loopbackOrigin(port);
  const devCommand = ["dev", "--host", loopback, "--port", String(port), "--strictPort"];
  const child = spawn(vitePlus, devCommand, {
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
      reachHealth({
        alive: () => child.exitCode === null && child.signalCode === null,
        log,
        origin,
      }),
  };
};

const startAttempts = 3;

const serveApplication = async (
  server: ApplicationServer,
  attempt = 1,
): Promise<{ readonly stop: () => Promise<void> }> => {
  const running = await startApplication(server);
  try {
    await running.waitUntilReady();
    return running;
  } catch (unready) {
    await running.stop();
    if (attempt >= startAttempts) {
      throw unready;
    }
    return serveApplication(server, attempt + 1);
  }
};

export { serveApplication };
