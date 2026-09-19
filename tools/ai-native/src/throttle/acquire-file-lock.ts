import { randomBytes } from "node:crypto";
import { closeSync, openSync, writeFileSync } from "node:fs";

import { once } from "es-toolkit/function";
import { tryLock } from "fs-native-extensions";

import { closeFileDescriptorAfterFailure, releaseFileLock } from "./release-file-lock.ts";

const lockedDescriptor = (lockPath: string): number | null => {
  const descriptor = openSync(lockPath, "r+");
  const acquired = (() => {
    try {
      return tryLock(descriptor);
    } catch (lockFailure) {
      return closeFileDescriptorAfterFailure({
        descriptor,
        precedingFailure: lockFailure,
      });
    }
  })();
  if (!acquired) {
    closeSync(descriptor);
    return null;
  }
  return descriptor;
};

const releaseDescriptor = (descriptor: number): void => {
  releaseFileLock(descriptor);
};

const releaseAfterGenerationFailure = (input: {
  descriptor: number;
  generationWriteFailure: unknown;
}): never => {
  try {
    releaseDescriptor(input.descriptor);
  } catch (releaseFailure) {
    throw new AggregateError(
      [input.generationWriteFailure, releaseFailure],
      `Could not record a generation or release file descriptor ${input.descriptor}`,
    );
  }
  throw input.generationWriteFailure;
};

const recordGeneration = (markerPath: string, descriptor: number): void => {
  try {
    writeFileSync(markerPath, randomBytes(16).toString("hex"));
  } catch (generationWriteFailure) {
    releaseAfterGenerationFailure({ descriptor, generationWriteFailure });
  }
};

export const tryAcquireFileLock = (input: {
  lockPath: string;
  markerPath: string;
}): { release: () => Promise<void> } | null => {
  const descriptor = lockedDescriptor(input.lockPath);
  if (descriptor === null) return null;
  recordGeneration(input.markerPath, descriptor);
  return {
    release: once(
      () =>
        new Promise<void>((resolve) => {
          releaseDescriptor(descriptor);
          resolve();
        }),
    ),
  };
};
