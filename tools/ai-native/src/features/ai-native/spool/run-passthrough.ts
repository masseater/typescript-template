import { Effect } from "effect";

import { spawnChild } from "../node-spawn.ts";
import { childEnvironment } from "../telemetry/command-telemetry.ts";
import {
  exitCodeOf,
  startFailureSummary,
  waitClose,
  waitSpawn,
  type ChildEnd,
} from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";

import type { Command } from "./parse-command.ts";

export const isPassthroughSignalled = (ciSignal: string | undefined): boolean =>
  ciSignal !== undefined && ciSignal !== "" && ciSignal !== "false";

export type PassthroughDeps = {
  stdout: { write: (part: string) => unknown };
  stderr: { write: (part: string) => unknown };
  monotonicNow: () => number;
};

const reportStartFailure = (input: {
  deps: PassthroughDeps;
  commandLine: string;
  closed: Promise<ChildEnd>;
  spawnError: Error;
}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* announceStartFailure() {
      yield* Effect.promise(() => input.closed);
      input.deps.stderr.write(startFailureSummary(input.commandLine, input.spawnError));
      return 127;
    }),
  );

const spawnPassthrough = (command: Command) => {
  const environment = childEnvironment();
  return spawnChild({
    executable: command[0],
    handed: command.slice(1),
    spawnOptions:
      environment === undefined ? { stdio: "inherit" } : { stdio: "inherit", env: environment },
  });
};

export const runPassthrough = (command: Command, deps: PassthroughDeps): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* passThroughCommand() {
      const commandLine = command.join(" ");
      const startedAt = deps.monotonicNow();
      const child = spawnPassthrough(command);
      const closed = waitClose(child);
      const spawnError = yield* Effect.promise(() => waitSpawn(child));
      if (spawnError !== null) {
        return yield* Effect.promise(() =>
          reportStartFailure({ deps, commandLine, closed, spawnError }),
        );
      }
      const exitCode = exitCodeOf(yield* Effect.promise(() => closed));
      deps.stdout.write(
        `spool: command: ${commandLine}\nspool: exit: ${exitCode} (${formatElapsed(deps.monotonicNow() - startedAt)})\n`,
      );
      return exitCode;
    }),
  );
