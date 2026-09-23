import { constants } from "node:os";

import { Effect } from "effect";

import { CHILD_PROCESS_EVENT } from "../node-event-names.ts";

import type { SpawnedChild } from "../node-spawn.ts";

export type ChildEnd = { code: number | null; signal: NodeJS.Signals | null };

export const exitCodeOf = (end: ChildEnd): number => {
  if (end.code !== null) {
    return end.code;
  }
  return 128 + constants.signals[end.signal as NodeJS.Signals];
};

export const waitSpawn = (child: SpawnedChild): Promise<Error | null> =>
  Effect.runPromise(
    Effect.callback<Error | null>((resume) => {
      child.once(CHILD_PROCESS_EVENT.spawn, () => {
        resume(Effect.succeed(null));
      });
      child.once(CHILD_PROCESS_EVENT.failure, (spawnError: Error) => {
        resume(Effect.succeed(spawnError));
      });
    }),
  );

export const waitClose = (child: SpawnedChild): Promise<ChildEnd> =>
  Effect.runPromise(
    Effect.callback<ChildEnd>((resume) => {
      child.once(
        CHILD_PROCESS_EVENT.close,
        (code: number | null, signal: NodeJS.Signals | null) => {
          resume(Effect.succeed({ code, signal }));
        },
      );
    }),
  );

export const startFailureSummary = (commandLine: string, spawnError: Error): string =>
  `spool: command: ${commandLine}\nspool: error: cannot start command: ${String(spawnError)}\n`;
