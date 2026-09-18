import { request, resultError } from "./request";
import { useAtom, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

type Task = () => Promise<void>;

interface ActionState {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly pending: boolean;
  readonly run: (task: Task) => void;
}

const hydratedAtom = Atom.make(true).pipe(Atom.withServerValue(() => false));

const actionAtom = Atom.family((_key: string) =>
  Atom.fn(({ task }: Readonly<{ task: Task }>) => request(task)),
);

function useAction(): ActionState {
  const [result, perform] = useAtom(actionAtom(useId()));
  const hydrated = useAtomValue(hydratedAtom);
  const pending = result.waiting;
  const blocked = pending || !hydrated;
  function run(task: Task): void {
    if (!blocked) {
      perform({ task });
    }
  }
  return { blocked, error: resultError(result), pending, run };
}

export { useAction };
export type { ActionState };
