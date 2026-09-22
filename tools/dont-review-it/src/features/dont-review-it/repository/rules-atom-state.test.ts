import { describe, expect, it } from "vite-plus/test";

import { reportCount, reported, reportedRules } from "./lint-harness.ts";

const unmanagedState = [
  [
    "named",
    "libs/ui/src/features/ui/probe.tsx",
    'import { useState } from "react"; export const Panel = () => useState(0);',
  ],
  [
    "alias",
    "apps/service-member/src/probe.ts",
    'import { useReducer as reduce } from "react"; export const fn = () => reduce(() => 0, 0);',
  ],
  [
    "default-member",
    "apps/service-admin/src/probe.ts",
    'import React from "react"; export const fn = () => React.useSyncExternalStore(() => () => undefined, () => 0);',
  ],
  [
    "namespace-destructure",
    "apps/internal-dashboard/src/probe.ts",
    'import * as React from "react"; const { useRef } = React; export const fn = () => useRef(null);',
  ],
  [
    "create-ref",
    "libs/ui/src/features/ui/probe.ts",
    'import { createRef } from "react"; export const r = createRef();',
  ],
  [
    "class-component",
    "libs/ui/src/features/ui/probe.ts",
    'import { Component } from "react"; export class Panel extends Component {}',
  ],
  [
    "pure-component",
    "libs/ui/src/features/ui/probe.ts",
    'import { PureComponent } from "react"; export class Panel extends PureComponent {}',
  ],
  [
    "action-state",
    "libs/ui/src/features/ui/probe.ts",
    'import { useActionState } from "react"; export const fn = () => useActionState(async () => 0, 0);',
  ],
  [
    "form-status",
    "libs/ui/src/features/ui/probe.ts",
    'import { useFormStatus } from "react-dom"; export const fn = () => useFormStatus();',
  ],
  [
    "form-state",
    "libs/ui/src/features/ui/probe.ts",
    'import { useFormState } from "react-dom"; export const fn = useFormState;',
  ],
  [
    "scoped-atom",
    "libs/ui/src/features/ui/probe.ts",
    'import { make } from "@effect/atom-react"; import { Atom } from "effect/unstable/reactivity"; export const Scoped = make(() => Atom.make(0));',
  ],
  [
    "suspense",
    "libs/ui/src/features/ui/probe.ts",
    'import { useAtomSuspense } from "@effect/atom-react"; export const read = useAtomSuspense;',
  ],
  [
    "initial-values",
    "libs/ui/src/features/ui/probe.ts",
    'import * as AtomReact from "@effect/atom-react"; export const seed = AtomReact.useAtomInitialValues;',
  ],
  [
    "hydration-boundary",
    "libs/ui/src/features/ui/probe.ts",
    'import { HydrationBoundary } from "@effect/atom-react"; export const Boundary = HydrationBoundary;',
  ],
  [
    "registry-context",
    "libs/ui/src/features/ui/probe.ts",
    'import { RegistryContext } from "@effect/atom-react"; export const Registry = RegistryContext;',
  ],
  [
    "atom-ref",
    "libs/ui/src/features/ui/probe.ts",
    'import { AtomRef } from "effect/unstable/reactivity"; export const ref = AtomRef.make(0);',
  ],
  [
    "atom-ref-hook",
    "libs/ui/src/features/ui/probe.ts",
    'import { useAtomRef } from "@effect/atom-react"; export const read = useAtomRef;',
  ],
  [
    "search-param",
    "apps/service-member/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; export const keyword = Atom.searchParam("keyword");',
  ],
  ["named-reexport", "libs/ui/src/features/ui/probe.ts", 'export { useState as useLocal } from "react";'],
  ["star-reexport", "libs/ui/src/features/ui/probe.ts", 'export * from "react";'],
] as const;

const allowedCode = [
  [
    "component-state",
    'import { useAtom } from "@effect/atom-react"; import { Atom } from "effect/unstable/reactivity"; import { useId } from "react"; const openAtom = Atom.family((_key: string) => Atom.make(false)); export const useOpen = () => useAtom(openAtom(useId()));',
  ],
  [
    "context",
    'import { createContext, use } from "react"; const Theme = createContext("light"); export const useTheme = () => use(Theme);',
  ],
  [
    "transition",
    'import { useOptimistic, useTransition } from "react"; export const useSaving = () => [useTransition(), useOptimistic(0)];',
  ],
] as const;

describe("atom-state", () => {
  it.for(unmanagedState)("rejects client state outside Effect Atom: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("atom-state", { code, filename: name })).toBe(true);
  });

  it("reports a default import member call once", () => {
    expect.hasAssertions();
    expect(
      reportCount("atom-state", {
        code: 'import React from "react"; export const fn = () => React.useState(0);',
        filename: "libs/ui/src/features/ui/probe.ts",
      }),
    ).toBe(1);
  });

  it.for(allowedCode)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: "libs/ui/src/features/ui/probe.ts" })).toStrictEqual([]);
  });
});
