import { Cause, Effect, Exit, PlatformError, Scope } from "effect";
import { attempt } from "es-toolkit";
import { unlock } from "fs-native-extensions";

import { nativeFailure } from "../host.ts";

export type LockedFile = { readonly descriptor: number; readonly scope: Scope.Closeable };

const asError = (squashed: unknown): Error => {
  if (squashed instanceof PlatformError.PlatformError) return nativeFailure(squashed);
  return squashed instanceof Error ? squashed : new Error(String(squashed), { cause: squashed });
};

export const closeFailureOf = (locked: LockedFile): Effect.Effect<Error | null> =>
  Scope.close(locked.scope, Exit.void).pipe(
    Effect.exit,
    Effect.map((closed) => (Exit.isSuccess(closed) ? null : asError(Cause.squash(closed.cause)))),
  );

export const closeFileDescriptorAfterFailure = (input: {
  locked: LockedFile;
  precedingFailure: Error;
}): Effect.Effect<never, Error> =>
  closeFailureOf(input.locked).pipe(
    Effect.flatMap((closeFailure) =>
      Effect.fail(
        closeFailure === null
          ? input.precedingFailure
          : new AggregateError(
              [input.precedingFailure, closeFailure],
              `Operation and close both failed for file descriptor ${input.locked.descriptor}`,
            ),
      ),
    ),
  );

export const releaseFileLock = (locked: LockedFile): Effect.Effect<void, Error> =>
  Effect.gen(function* unlockAndClose() {
    const [unlockFailure] = attempt<true, Error>(() => {
      unlock(locked.descriptor);
      return true;
    });
    const closeFailure = yield* closeFailureOf(locked);
    if (unlockFailure !== null && closeFailure !== null) {
      return yield* Effect.fail(
        new AggregateError(
          [unlockFailure, closeFailure],
          `Could not unlock and close file descriptor ${locked.descriptor}`,
        ),
      );
    }
    if (unlockFailure !== null) return yield* Effect.fail(unlockFailure);
    if (closeFailure !== null) return yield* Effect.fail(closeFailure);
  });
