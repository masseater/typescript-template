import { useAtom, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

import { makeActionQueue, type ActionQueueStatus, type Task } from "./action-queue.ts";

type ActionState = {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
};

const hydratedAtom = Atom.make(true).pipe(Atom.withServerValue(() => false));

const actionAtom = Atom.family((slotId: string) => {
  void slotId;
  const queue = makeActionQueue();
  return Atom.writable(
    (get): ActionQueueStatus => {
      get.addFinalizer(
        queue.subscribe((status) => {
          get.setSelf(status);
        }),
      );
      return queue.status();
    },
    (_ctx, task: Task) => {
      queue.run(task);
    },
  );
});

const useAction = (): ActionState => {
  const [status, enqueue] = useAtom(actionAtom(useId()));
  const hydrated = useAtomValue(hydratedAtom);
  const pending = status.pending;
  const blocked = pending || !hydrated;
  const run = (task: Task): void => {
    if (!hydrated) {
      return;
    }
    enqueue(task);
  };
  return { blocked, error: status.error, pending, run };
};

export { useAction };
export type { ActionState };
