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
    "create-ref",
    "libs/ui/src/probe.ts",
    'import { createRef } from "react"; export const r = createRef();',
  ],
  [
    "class-component",
    "libs/ui/src/probe.ts",
    'import { Component } from "react"; export class Panel extends Component {}',
  ],
  [
    "pure-component",
    "libs/ui/src/probe.ts",
    'import { PureComponent } from "react"; export class Panel extends PureComponent {}',
  ],
  [
    "action-state",
    "libs/ui/src/probe.ts",
    'import { useActionState } from "react"; export const fn = () => useActionState(async () => 0, 0);',
  ],
  [
    "form-status",
    "libs/ui/src/probe.ts",
    'import { useFormStatus } from "react-dom"; export const fn = () => useFormStatus();',
  ],
  [
    "form-state",
    "libs/ui/src/probe.ts",
    'import { useFormState } from "react-dom"; export const fn = useFormState;',
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
    "hydration-boundary",
    "libs/ui/src/probe.ts",
    'import { HydrationBoundary } from "@effect/atom-react"; export const Boundary = HydrationBoundary;',
  ],
  [
    "registry-context",
    "libs/ui/src/probe.ts",
    'import { RegistryContext } from "@effect/atom-react"; export const Registry = RegistryContext;',
  ],
  [
    "atom-ref",
    "libs/ui/src/probe.ts",
    'import { AtomRef } from "effect/unstable/reactivity"; export const ref = AtomRef.make(0);',
  ],
  [
    "atom-ref-hook",
    "libs/ui/src/probe.ts",
    'import { useAtomRef } from "@effect/atom-react"; export const read = useAtomRef;',
  ],
  [
    "search-param",
    "apps/user/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; export const keyword = Atom.searchParam("keyword");',
  ],
  ["named-reexport", "libs/ui/src/probe.ts", 'export { useState as useLocal } from "react";'],
  ["star-reexport", "libs/ui/src/probe.ts", 'export * from "react";'],
] as const;

const serverDataInAtoms = [
  [
    "fetch-in-make",
    "libs/ui/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.make(Effect.promise(() => fetch("/api/session")));',
  ],
  [
    "fetch-in-local-function",
    "apps/wiki/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; async function load() { return (await fetch("/x")).json(); } export const a = Atom.make(Effect.promise(load));',
  ],
  [
    "api-segment-in-family",
    "apps/admin/src/pages/users/model/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; import { listUsers } from "#pages/users/api/list-users.ts"; export const a = Atom.family((q: string) => Atom.make(Effect.promise(() => listUsers(q))));',
  ],
  [
    "client-module-in-readable",
    "libs/ui/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; import { authClient } from "./client"; export const a = Atom.readable(() => authClient.getSession());',
  ],
  [
    "request-atom-from-ui",
    "apps/wiki/src/probe.ts",
    'import { requestAtom } from "@template/ui"; export const a = requestAtom(async () => fetch("/api/session"));',
  ],
  [
    "request-atom-inside-ui",
    "libs/ui/src/probe.ts",
    'import { requestAtom } from "./request"; export const a = requestAtom(async () => fetch("/api/session"));',
  ],
  [
    "atom-refresh-hook",
    "libs/ui/src/probe.ts",
    'import { useAtomRefresh } from "@effect/atom-react"; export const r = useAtomRefresh;',
  ],
  [
    "atom-refresh-member",
    "libs/ui/src/probe.ts",
    'import { Atom } from "effect/unstable/reactivity"; export const r = Atom.refreshOnWindowFocus;',
  ],
  [
    "reactivity-service",
    "libs/ui/src/probe.ts",
    'import { Reactivity } from "effect/unstable/reactivity"; export const r = Reactivity;',
  ],
  [
    "atom-http-api",
    "libs/ui/src/probe.ts",
    'import { AtomHttpApi } from "effect/unstable/reactivity"; export const r = AtomHttpApi;',
  ],
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
  [
    "browser-computation",
    'import { requestAtom } from "./request"; export const a = requestAtom(async () => (await import("mermaid")).default.render("id", "graph TD"));',
  ],
  [
    "derived-effect",
    'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.make(Effect.succeed(1));',
  ],
] as const;

describe("atom-state", () => {
  it.for(unmanagedState)("rejects client state outside Effect Atom: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("atom-state", name, code)).toBe(true);
  });

  it.for(serverDataInAtoms)("rejects server data held in atoms: %s", ([_label, name, code]) => {
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

  it.for(allowedCode)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reportedRules("libs/ui/src/probe.ts", code)).toStrictEqual([]);
  });
});
