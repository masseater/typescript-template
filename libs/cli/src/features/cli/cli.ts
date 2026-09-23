import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

import { markFailed } from "./exit-code.ts";

const firstUserArgumentIndex = 2;

type WriteTarget = Readonly<{ write: (line: string) => unknown }>;

const cliStdout: WriteTarget = {
  write: (line) => process.stdout.write(line),
};

const cliStderr: WriteTarget = {
  write: (line) => process.stderr.write(line),
};

const causeRecord = (
  eventName: string,
  failure: {
    readonly cause: Cause.Cause<unknown>;
    readonly fields?: Readonly<Record<string, unknown>>;
  },
): Readonly<Record<string, unknown>> => ({
  cause: Cause.pretty(failure.cause),
  event: eventName,
  ok: false,
  ...failure.fields,
});

const reportFailed = (failureRecord: Readonly<Record<string, unknown>>): Effect.Effect<void> =>
  Console.error(JSON.stringify(failureRecord)).pipe(Effect.andThen(markFailed));

const runCli = <Failure>(
  program: Effect.Effect<unknown, Failure>,
  onFailure: (cause: Cause.Cause<Failure>) => Readonly<Record<string, unknown>>,
): void => {
  NodeRuntime.runMain(
    program.pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => reportFailed(onFailure(cause)),
      ),
    ),
    { disableErrorReporting: true },
  );
};

export { causeRecord, cliStderr, cliStdout, firstUserArgumentIndex, reportFailed, runCli };
export type { WriteTarget };
