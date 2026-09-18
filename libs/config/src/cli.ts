import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

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

type FailureRecord = Readonly<Record<string, unknown>>;
type FailureReport<Failure> = FailureRecord | ((cause: Cause.Cause<Failure>) => FailureRecord);

function runCli<Failure>(
  program: Effect.Effect<unknown, Failure>,
  onFailure: FailureReport<Failure>,
): void {
  // oxlint-disable-next-line eslint/no-restricted-properties
  NodeRuntime.runMain(
    program.pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : reportFailed(typeof onFailure === "function" ? onFailure(cause) : onFailure),
      ),
    ),
    { disableErrorReporting: true },
  );
}

export { exitWith, markFailed, reportFailed, runCli };
