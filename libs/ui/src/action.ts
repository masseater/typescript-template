import { useAtom, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

import { request, resultError } from "./request";

type Task = () => Promise<void>;

type ActionState = {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
};

const hydratedAtom = Atom.make(true).pipe(Atom.withServerValue(() => false));

const actionAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.fn(({ task }: Readonly<{ task: Task }>) => request(task));
});

const useAction = (): ActionState => {
  const [asyncState, perform] = useAtom(actionAtom(useId()));
  const hydrated = useAtomValue(hydratedAtom);
  const pending = asyncState.waiting;
  const blocked = pending || !hydrated;
  const run = (task: Task): void => {
    if (!blocked) {
      perform({ task });
    }
  };
  return { blocked, error: resultError(asyncState), pending, run };
};

export { useAction };
export type { ActionState };
