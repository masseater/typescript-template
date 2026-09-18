import { Atom } from "effect/unstable/reactivity";
import { useAtom } from "@effect/atom-react";
import { useId } from "react";

type LocalState<Value> = () => readonly [
  Value,
  (next: Value | ((current: Value) => Value)) => void,
];

function localState<Value>(initial: Value): LocalState<Value> {
  const stateAtom = Atom.family((_key: string) => Atom.make(initial));
  function useLocalState(): ReturnType<LocalState<Value>> {
    return useAtom(stateAtom(useId()));
  }
  return useLocalState;
}

export { localState };
