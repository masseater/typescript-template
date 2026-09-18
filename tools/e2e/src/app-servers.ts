// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as delay } from "node:timers/promises";

import type { Application } from "@repo/config";

import type { Environment } from "./local-database.ts";
import { loopback } from "./ports.ts";
import { applicationRoot, packageRoot } from "./repository.ts";
import { deadlineIn, until } from "./waiting.ts";

const readyTimeout = 300_000;
const requestTimeout = 120_000;
const stopTimeout = 30_000;
const okStatus = 200;
const healthPath = "/api/health";
const vitePlus = packageRoot("node_modules/.bin/vp");

function killGroup(pid: number, signal: "SIGKILL" | "SIGTERM"): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

function startApplication(
  application: Application,
  port: number,
  environment: Environment,
): () => Promise<void> {
  const args = ["dev", "--host", loopback, "--port", String(port), "--strictPort"];
  const child = spawn(vitePlus, args, {
    cwd: applicationRoot(application),
    detached: true,
    env: environment,
    stdio: "ignore",
  });
  child.on("error", () => {
    child.kill("SIGKILL");
  });
  return async () => {
    const { pid } = child;
    if (pid === undefined) {
      return;
    }
    killGroup(pid, "SIGTERM");
    await Promise.race([once(child, "exit"), delay(stopTimeout, undefined, { ref: false })]);
    killGroup(pid, "SIGKILL");
  };
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
