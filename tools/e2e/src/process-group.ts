// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as delay } from "node:timers/promises";

// oxlint-disable-next-line import/no-nodejs-modules
import type { ChildProcess } from "node:child_process";

const stopTimeout = 30_000;

function killGroup(pid: number, signal: "SIGKILL" | "SIGTERM"): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function stopGroup(child: ChildProcess): Promise<void> {
  const { pid } = child;
  if (pid === undefined) {
    return;
  }
  killGroup(pid, "SIGTERM");
  await Promise.race([once(child, "exit"), delay(stopTimeout, undefined, { ref: false })]);
  killGroup(pid, "SIGKILL");
}

export { stopGroup };
