import { useAtom } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

import { localState } from "../local-state.ts";

const useNavigationOpen = localState(false);

const collapsedAtom = Atom.family((slot: string) => Atom.make(slot.endsWith(":collapsed")));

const trackedPathAtom = Atom.family((slot: string) => {
  void slot;
  return Atom.make("");
});

const useCollapsed = (
  defaultCollapsed: boolean,
): readonly [boolean, (update: (collapsedNow: boolean) => boolean) => void] => {
  const slot = `${useId()}:${defaultCollapsed ? "collapsed" : "expanded"}`;
  return useAtom(collapsedAtom(slot));
};

const useTrackedPath = (): readonly [string, (path: string) => void] => {
  return useAtom(trackedPathAtom(useId()));
};

const usePathAwareNavigation = (
  pathname: string,
): readonly [boolean, (update: boolean | ((open: boolean) => boolean)) => void] => {
  const [navigationOpen, setNavigationOpen] = useNavigationOpen();
  const [trackedPath, setTrackedPath] = useTrackedPath();
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    setNavigationOpen(false);
  }
  return [navigationOpen, setNavigationOpen];
};

export { useCollapsed, usePathAwareNavigation };
