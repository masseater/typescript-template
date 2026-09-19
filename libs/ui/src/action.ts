import { Effect, Ref } from "effect";
import { noop } from "es-toolkit";
import { useState, useSyncExternalStore } from "react";

import { errorMessage } from "./protocol.ts";

type Task = () => Promise<void>;

type ActionState = {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
};

const subscribeNothing = (): (() => void) => {
  return noop;
};

const clientSnapshot = (): boolean => {
  return true;
};

const serverSnapshot = (): boolean => {
  return false;
};

const failureOf = async (task: Task): Promise<string | undefined> => {
  try {
    await task();
  } catch (failure) {
    return errorMessage(failure);
  }
  return undefined;
};

const useAction = (): ActionState => {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const hydrated = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
  const [running, setRunning] = useState(() => Effect.runSync(Ref.make(false)));
  const run = (task: Task): void => {
    void setRunning;
    if (Effect.runSync(Ref.getAndSet(running, true))) {
      return;
    }
    setPending(true);
    setFailure(undefined);
    Effect.runFork(
      Effect.map(
        Effect.promise(async () => failureOf(task)),
        (taskFailure) => {
          if (taskFailure !== undefined) {
            setFailure(taskFailure);
          }
          Effect.runSync(Ref.set(running, false));
          setPending(false);
        },
      ),
    );
  };
  return { blocked: pending || !hydrated, error: failure, pending, run };
};

export { useAction };
export type { ActionState };
