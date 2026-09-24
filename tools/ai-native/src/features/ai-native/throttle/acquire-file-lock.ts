import { Effect, Exit, Scope, type FileSystem } from "effect";
import { attempt } from "es-toolkit";
import { once } from "es-toolkit/function";
import { tryLock } from "fs-native-extensions";

import { filesystem, onDisk, randomHex, writeFileString } from "../host.ts";
import {
  closeFailureOf,
  closeFileDescriptorAfterFailure,
  releaseFileLock,
  type LockedFile,
} from "./release-file-lock.ts";

const descriptorOf = (file: FileSystem.File): number | undefined =>
  "fd" in file && typeof file.fd === "number" ? file.fd : undefined;

const openLockFile = (lockPath: string): Effect.Effect<LockedFile, Error> =>
  Effect.gen(function* openInOwnScope() {
    const scope = yield* Scope.make();
    const file = yield* onDisk(filesystem.open(lockPath, { flag: "r+" })).pipe(
      Scope.provide(scope),
      Effect.tapError(() => Scope.close(scope, Exit.void)),
    );
    const descriptor = descriptorOf(file);
    if (descriptor === undefined) {
      yield* Scope.close(scope, Exit.void);
      return yield* Effect.die(`the file system opened ${lockPath} without a descriptor`);
    }
    return { descriptor, scope };
  });

const lockedFile = (lockPath: string): Effect.Effect<LockedFile | null, Error> =>
  Effect.gen(function* takeLock() {
    const locked = yield* openLockFile(lockPath);
    const [lockFailure, acquired] = attempt<boolean, Error>(() => tryLock(locked.descriptor));
    if (lockFailure !== null) {
      return yield* closeFileDescriptorAfterFailure({ locked, precedingFailure: lockFailure });
    }
    if (!acquired) {
      const closeFailure = yield* closeFailureOf(locked);
      return closeFailure === null ? null : yield* Effect.fail(closeFailure);
    }
    return locked;
  });

const releaseAfterGenerationFailure = (input: {
  locked: LockedFile;
  generationWriteFailure: Error;
}): Effect.Effect<never, Error> =>
  releaseFileLock(input.locked).pipe(
    Effect.matchEffect({
      onFailure: (releaseFailure) =>
        Effect.fail(
          new AggregateError(
            [input.generationWriteFailure, releaseFailure],
            `Could not record a generation or release file descriptor ${input.locked.descriptor}`,
          ),
        ),
      onSuccess: () => Effect.fail(input.generationWriteFailure),
    }),
  );

const recordGeneration = (markerPath: string, locked: LockedFile): Effect.Effect<void, Error> =>
  writeFileString({ location: markerPath, written: randomHex(16) }).pipe(
    Effect.matchEffect({
      onFailure: (generationWriteFailure) =>
        releaseAfterGenerationFailure({ locked, generationWriteFailure }),
      onSuccess: () => Effect.void,
    }),
  );

const holdOf = (locked: LockedFile): { release: () => Promise<void> } => ({
  release: once(() => Effect.runPromise(releaseFileLock(locked))),
});

export const tryAcquireFileLock = (input: {
  lockPath: string;
  markerPath: string;
}): Effect.Effect<{ release: () => Promise<void> } | null, Error> =>
  lockedFile(input.lockPath).pipe(
    Effect.tap((locked) =>
      locked === null ? Effect.void : recordGeneration(input.markerPath, locked),
    ),
    Effect.map((locked) => (locked === null ? null : holdOf(locked))),
  );
