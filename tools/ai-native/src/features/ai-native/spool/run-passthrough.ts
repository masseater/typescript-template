import { Effect } from "effect";
import { ChildProcess } from "effect/unstable/process";

import { childEndOf } from "../child-process.ts";
import { nativeFailure, spawner } from "../host.ts";
import { childEnvironment } from "../telemetry/command-telemetry.ts";
import { exitCodeOf, startFailureSummary } from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";

import type { Command } from "./parse-command.ts";

export const isPassthroughSignalled = (ciSignal: string | undefined): boolean =>
  ciSignal !== undefined && ciSignal !== "" && ciSignal !== "false";

export type PassthroughDeps = {
  stdout: { write: (part: string) => unknown };
  stderr: { write: (part: string) => unknown };
  monotonicNow: () => number;
};

const passthroughCommand = (command: Command): ChildProcess.Command => {
  const environment = childEnvironment();
  return ChildProcess.make(command[0], command.slice(1), {
    ...(environment === undefined ? {} : { env: environment }),
    detached: false,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
};

export const passThrough = (command: Command, deps: PassthroughDeps): Effect.Effect<number> =>
  Effect.scoped(
    Effect.gen(function* passThroughCommand() {
      const commandLine = command.join(" ");
      const startedAt = deps.monotonicNow();
      const handle = yield* spawner.spawn(passthroughCommand(command));
      const exitCode = exitCodeOf(yield* childEndOf(handle));
      deps.stdout.write(
        `spool: command: ${commandLine}\nspool: exit: ${exitCode} (${formatElapsed(deps.monotonicNow() - startedAt)})\n`,
      );
      return exitCode;
    }),
  ).pipe(
    Effect.matchEffect({
      onFailure: (spawnFailure) =>
        Effect.sync(() => {
          deps.stderr.write(startFailureSummary(command.join(" "), nativeFailure(spawnFailure)));
          return 127;
        }),
      onSuccess: Effect.succeed,
    }),
  );
