import { noop } from "es-toolkit";
import { useRef, useState, useSyncExternalStore } from "react";

import { errorMessage } from "./protocol";

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
  } catch (error) {
    return errorMessage(error);
  }
  return undefined;
};

const useAction = (): ActionState => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const hydrated = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
  const active = useRef(false);
  const run = (task: Task): void => {
    if (active.current) {
      return;
    }
    active.current = true;
    setPending(true);
    setError(undefined);
    const perform = async (): Promise<void> => {
      const failure = await failureOf(task);
      if (failure !== undefined) {
        setError(failure);
      }
      active.current = false;
      setPending(false);
    };
    void perform();
  };
  return { blocked: pending || !hydrated, error, pending, run };
};

export { useAction };
export type { ActionState };
