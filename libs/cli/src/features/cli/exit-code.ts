import { Effect } from "effect";

const failedExitCode = 1;

const exitWith = (code: number): Effect.Effect<void> =>
  Effect.sync(() => {
    process.exitCode = code;
  });

const markFailed = exitWith(failedExitCode);

export { exitWith, markFailed };
