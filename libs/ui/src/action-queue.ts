type Task = () => Promise<void>;

type ActionQueueStatus = {
  readonly error: string | undefined;
  readonly pending: boolean;
};

type ActionQueue = {
  readonly run: (task: Task) => void;
  readonly status: () => ActionQueueStatus;
  readonly subscribe: (listener: (status: ActionQueueStatus) => void) => () => void;
};

const failureMessage = (cause: unknown): string => {
  return cause instanceof Error
    ? cause.message
    : "操作に失敗しました。もう一度お試しください。";
};

const makeActionQueue = (): ActionQueue => {
  let depth = 0;
  let error: string | undefined;
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<(status: ActionQueueStatus) => void>();

  const emit = (): void => {
    const status = { error, pending: depth > 0 };
    for (const listener of listeners) {
      listener(status);
    }
  };

  return {
    run: (task) => {
      depth += 1;
      emit();
      chain = chain.catch(() => undefined).then(async () => {
        try {
          await task();
          error = undefined;
        } catch (cause) {
          error = failureMessage(cause);
        } finally {
          depth -= 1;
          emit();
        }
      });
    },
    status: () => ({ error, pending: depth > 0 }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export { makeActionQueue };
export type { ActionQueue, ActionQueueStatus, Task };
