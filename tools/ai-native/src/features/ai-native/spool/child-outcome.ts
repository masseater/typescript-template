import { signalNumber } from "../host.ts";

import type { ChildEnd } from "../child-process.ts";

export const exitCodeOf = (end: ChildEnd): number =>
  end.signal === null ? end.code : 128 + signalNumber(end.signal);

export const startFailureSummary = (commandLine: string, spawnError: Error): string =>
  `spool: command: ${commandLine}\nspool: error: cannot start command: ${String(spawnError)}\n`;
