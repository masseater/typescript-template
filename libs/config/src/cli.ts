import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

const failedExitCode = 1;

function exitWith(code: number): Effect.Effect<void> {
  return Effect.sync(() => {
    process.exitCode = code;
  });
}

const markFailed = exitWith(failedExitCode);

function reportFailed(record: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Console.error(JSON.stringify(record)).pipe(Effect.andThen(markFailed));
}

type FailureReport<Failure> =
  | Readonly<Record<string, unknown>>
  | ((cause: Cause.Cause<Failure>) => Readonly<Record<string, unknown>>);

function runCli<Failure>(
  program: Effect.Effect<unknown, Failure>,
  onFailure: FailureReport<Failure>,
): void {
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
