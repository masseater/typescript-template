import { attempt } from "es-toolkit";
import { unlock } from "fs-native-extensions";

import { closeDescriptor } from "../host-descriptors.ts";

export const closeFileDescriptorAfterFailure = (input: {
  descriptor: number;
  precedingFailure: unknown;
}): never => {
  const [closeFailure] = attempt<true, Error>(() => {
    closeDescriptor(input.descriptor);
    return true;
  });
  if (closeFailure !== null) {
    throw new AggregateError(
      [input.precedingFailure, closeFailure],
      `Operation and close both failed for file descriptor ${input.descriptor}`,
    );
  }
  throw input.precedingFailure;
};

export const releaseFileLock = (descriptor: number): void => {
  const [unlockFailure] = attempt<true, Error>(() => {
    unlock(descriptor);
    return true;
  });
  const [closeFailure] = attempt<true, Error>(() => {
    closeDescriptor(descriptor);
    return true;
  });
  if (unlockFailure !== null && closeFailure !== null) {
    throw new AggregateError(
      [unlockFailure, closeFailure],
      `Could not unlock and close file descriptor ${descriptor}`,
    );
  }
  if (unlockFailure !== null) throw unlockFailure;
  if (closeFailure !== null) throw closeFailure;
};
