import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { startTransition, useId } from "react";

import { makeActionQueue, type ActionQueue, type ActionQueueStatus, type Task } from "./action-queue.ts";

type ActionState = {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
};

type ActionSlot = Atom.Atom<ActionQueueStatus> & {
  readonly queue: ActionQueue;
};

const hydratedAtom = Atom.make(true).pipe(Atom.withServerValue(() => false));

const actionAtom = Atom.family((slotId: string): ActionSlot => {
  void slotId;
  const queue = makeActionQueue();
  const statusAtom = Atom.readable((get): ActionQueueStatus => {
    get.addFinalizer(
      queue.subscribe((status) => {
        get.setSelf(status);
      }),
    );
    return queue.status();
  });
  return Object.assign(statusAtom, { queue });
});

const useAction = (): ActionState => {
  const slot = actionAtom(useId());
  const status = useAtomValue(slot);
  const hydrated = useAtomValue(hydratedAtom);
  const pending = status.pending;
  const blocked = pending || !hydrated;
  const run = (task: Task): void => {
    if (!hydrated) {
      return;
    }
    startTransition(async () => {
      await slot.queue.run(task);
    });
  };
  return { blocked, error: status.error, pending, run };
};

export { useAction };
export type { ActionState };
