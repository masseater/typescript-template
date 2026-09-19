import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

const failedExitCode = 1;
const firstUserArgumentIndex = 2;

function exitWith(code: number): Effect.Effect<void> {
  return Effect.sync(() => {
    process.exitCode = code;
  });
}

const markFailed = exitWith(failedExitCode);

function reportFailed(record: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Console.error(JSON.stringify(record)).pipe(Effect.andThen(markFailed));
}

function causeRecord(
  event: string,
  cause: Cause.Cause<unknown>,
  fields: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return { cause: Cause.pretty(cause), event, ok: false, ...fields };
}

type FailureReport<Failure> = (cause: Cause.Cause<Failure>) => Readonly<Record<string, unknown>>;

function runCli<Failure>(
  program: Effect.Effect<unknown, Failure>,
  onFailure: FailureReport<Failure>,
): void {
  NodeRuntime.runMain(
    program.pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause) ? Effect.failCause(cause) : reportFailed(onFailure(cause)),
      ),
    ),
    { disableErrorReporting: true },
  );
}

export { causeRecord, exitWith, firstUserArgumentIndex, markFailed, reportFailed, runCli };
