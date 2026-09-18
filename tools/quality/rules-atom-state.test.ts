import { describe, expect, it } from "vite-plus/test";
import { reportCount, reported, reportedRules } from "./lint-harness.ts";

const unmanagedState = [
  [
    "named",
    "libs/ui/src/probe.tsx",
    'import { useState } from "react"; export const Panel = () => useState(0);',
  ],
  [
    "alias",
    "apps/user/src/probe.ts",
    'import { useReducer as reduce } from "react"; export const fn = () => reduce(() => 0, 0);',
  ],
  [
    "default-member",
    "apps/admin/src/probe.ts",
    'import React from "react"; export const fn = () => React.useSyncExternalStore(() => () => undefined, () => 0);',
  ],
  [
    "namespace-destructure",
    "apps/wiki/src/probe.ts",
    'import * as React from "react"; const { useRef } = React; export const fn = () => useRef(null);',
  ],
  [
    "context",
    "libs/ui/src/probe.ts",
    'import { createContext } from "react"; export const Scope = createContext(0);',
  ],
  [
    "use",
    "libs/ui/src/probe.ts",
    'import { use } from "react"; export const read = (value: Promise<number>) => use(value);',
  ],
  [
    "class-component",
    "libs/ui/src/probe.ts",
    'import { Component } from "react"; export class Panel extends Component {}',
  ],
  [
    "form-status",
    "libs/ui/src/probe.ts",
    'import { useFormStatus } from "react-dom"; export const fn = () => useFormStatus();',
  ],
  [
    "scoped-atom",
    "libs/ui/src/probe.ts",
    'import { make } from "@effect/atom-react"; import { Atom } from "effect/unstable/reactivity"; export const Scoped = make(() => Atom.make(0));',
  ],
  [
    "suspense",
    "libs/ui/src/probe.ts",
    'import { useAtomSuspense } from "@effect/atom-react"; export const read = useAtomSuspense;',
  ],
  [
    "initial-values",
    "libs/ui/src/probe.ts",
    'import * as AtomReact from "@effect/atom-react"; export const seed = AtomReact.useAtomInitialValues;',
  ],
  [
    "search-param",
    "apps/user/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; export const keyword = Atom.searchParam("keyword");',
  ],
  [
    "search-param-module",
    "apps/user/src/probe.ts",
    'import * as Atom from "effect/unstable/reactivity/Atom"; export const keyword = Atom.searchParam("keyword");',
  ],
] as const;

describe("atom-state", () => {
  it.for(unmanagedState)("rejects state outside Effect Atom: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("atom-state", name, code)).toBe(true);
  });

  it("reports a default import member call once", () => {
    expect.hasAssertions();
    expect(
      reportCount(
        "atom-state",
        "libs/ui/src/probe.ts",
        'import React from "react"; export const fn = () => React.useState(0);',
      ),
    ).toBe(1);
  });

  it("allows component state held in an Effect Atom", () => {
    expect.hasAssertions();
    expect(
      reportedRules(
        "libs/ui/src/probe.ts",
        'import { useAtom } from "@effect/atom-react"; import { Atom } from "effect/unstable/reactivity"; import { useId } from "react"; const openAtom = Atom.family((_key: string) => Atom.make(false)); export const useOpen = () => useAtom(openAtom(useId()));',
      ),
    ).toStrictEqual([]);
  });
});
