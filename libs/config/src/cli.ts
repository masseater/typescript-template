import { Console, Effect } from "effect";

const failedExitCode = 1;

function exitWith(code: number): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line eslint/no-restricted-properties
    process.exitCode = code;
  });
}

const markFailed = exitWith(failedExitCode);

function reportFailed(record: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Console.error(JSON.stringify(record)).pipe(Effect.andThen(markFailed));
}

export { exitWith, markFailed, reportFailed };
