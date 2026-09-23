import { attemptAsync } from "es-toolkit";

import { measureCheck } from "./check-telemetry.ts";

export const EXIT_SUCCESS = 0;

export const EXIT_PROBLEMS_FOUND = 1;

export const EXIT_MISUSE = 2;

export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

const misuseOf = (failure: unknown): CliResult => ({
  exitCode: EXIT_MISUSE,
  out: "",
  error: `${failure instanceof Error ? failure.message : String(failure)}\n`,
});

const safelyRunCli = (operation: () => Promise<CliResult>): Promise<CliResult> =>
  attemptAsync(operation).then(([failure, completedRun]) => completedRun ?? misuseOf(failure));

export const createCliRunner =
  <Arguments extends readonly unknown[]>(
    operation: (...args: Arguments) => Promise<CliResult>,
  ): ((...args: Arguments) => Promise<CliResult>) =>
  (...handed) =>
    measureCheck(() => safelyRunCli(() => operation(...handed)));
