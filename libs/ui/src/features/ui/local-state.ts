import { useAtom } from "@effect/atom-react";
import { Option } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

type LocalState<Value> = () => readonly [
  Value,
  (next: Value | ((current: Value) => Value)) => void,
];

const localState = <Value>(initial: Value): LocalState<Value> => {
  const stateAtom = Atom.family((slotId: string) => {
    void slotId;
    return Atom.make(initial);
  });
  const useLocalState = (): ReturnType<LocalState<Value>> => {
    return useAtom(stateAtom(useId()));
  };
  return useLocalState;
};

const optionalState = <Value>(): LocalState<Option.Option<Value>> =>
  localState(Option.none<Value>());

const useOptionalString = optionalState<string>();

export { localState, optionalState, useOptionalString };
