import { Atom } from "effect/unstable/reactivity";
import { useAtom } from "@effect/atom-react";

const draftAtom = Atom.family((keyword: string) => Atom.make(keyword));

function useSearchDraft(keyword: string): readonly [string, (draft: string) => void] {
  return useAtom(draftAtom(keyword));
}

export { useSearchDraft };
