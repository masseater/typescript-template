import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { errorMessage } from "./protocol";
import { noop } from "es-toolkit";

type Task = () => Promise<void>;

interface ActionState {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
}

function subscribeNothing(): () => void {
  return noop;
}

function clientSnapshot(): boolean {
  return true;
}

function serverSnapshot(): boolean {
  return false;
}

async function failureOf(task: Task): Promise<string | undefined> {
  try {
    await task();
  } catch (error) {
    return errorMessage(error);
  }
  return undefined;
}

function useAction(): ActionState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const hydrated = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
  const active = useRef(false);
  const run = useCallback((task: Task) => {
    if (active.current) {
      return;
    }
    active.current = true;
    setPending(true);
    setError(undefined);
    async function perform(): Promise<void> {
      const failure = await failureOf(task);
      if (failure !== undefined) {
        setError(failure);
      }
      active.current = false;
      setPending(false);
    }
    void perform();
  }, []);
  return { blocked: pending || !hydrated, error, pending, run };
}

export { useAction };
export type { ActionState };
