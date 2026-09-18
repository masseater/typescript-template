import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

const failedExitCode = 1;

const exitWith = (code: number): Effect.Effect<void> =>
  Effect.sync(() => {
    process.exitCode = code;
  });

const markFailed = exitWith(failedExitCode);

const reportFailed = (reported: Readonly<Record<string, unknown>>): Effect.Effect<void> =>
  Console.error(JSON.stringify(reported)).pipe(Effect.andThen(markFailed));

const runCli = <Failure>(
  program: Effect.Effect<unknown, Failure>,
  onFailure:
    | Readonly<Record<string, unknown>>
    | ((cause: Cause.Cause<Failure>) => Readonly<Record<string, unknown>>),
): void => {
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
};

export { exitWith, markFailed, reportFailed, runCli };
