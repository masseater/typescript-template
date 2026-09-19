import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

import type { ChildProcess } from "node:child_process";

const stopTimeout = 30_000;

const killGroup = (pid: number, signal: "SIGKILL" | "SIGTERM"): string => {
  try {
    process.kill(-pid, signal);
    return "";
  } catch (unsignalled) {
    return `E2E_PROCESS_GROUP_UNSIGNALLED ${String(unsignalled)}`;
  }
};

const stopGroup = async (child: ChildProcess): Promise<void> => {
  const { pid } = child;
  if (pid === undefined) {
    return;
  }
  killGroup(pid, "SIGTERM");
  await Promise.race([once(child, "exit"), delay(stopTimeout, undefined, { ref: false })]);
  killGroup(pid, "SIGKILL");
};

export { stopGroup };
