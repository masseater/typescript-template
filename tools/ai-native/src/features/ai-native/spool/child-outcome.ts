import { signalNumber } from "../host.ts";

import type { ChildEnd } from "../child-process.ts";

export const exitCodeOf = (end: ChildEnd): number => {
  if (end.code !== null) {
    return end.code;
  }
  return 128 + signalNumber(end.signal as NodeJS.Signals);
};

export const startFailureSummary = (commandLine: string, spawnError: Error): string =>
  `spool: command: ${commandLine}\nspool: error: cannot start command: ${String(spawnError)}\n`;
