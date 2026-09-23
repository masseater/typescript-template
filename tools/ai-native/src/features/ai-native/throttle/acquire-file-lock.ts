import { once } from "es-toolkit/function";
import { tryLock } from "fs-native-extensions";

import { closeDescriptor, openDescriptor } from "../host-descriptors.ts";
import { randomHex, writeFileString } from "../host.ts";
import { closeFileDescriptorAfterFailure, releaseFileLock } from "./release-file-lock.ts";

const lockedDescriptor = (lockPath: string): number | null => {
  const descriptor = openDescriptor(lockPath);
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
    closeDescriptor(descriptor);
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
    writeFileString({ location: markerPath, written: randomHex(16) });
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
    release: once(() => {
      releaseDescriptor(descriptor);
      return Promise.resolve();
    }),
  };
};
