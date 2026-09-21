import { describe, expect, it } from "vite-plus/test";

import { noHandRolledServerRead } from "../lint/oxlint/rules/mutation-and-failure/no-hand-rolled-server-read--use-tanstack-query.ts";
import { requireQueryOptionsInApiSegment } from "../lint/oxlint/rules/mutation-and-failure/require-query-options-in-api-segment--move-query-options-to-api.ts";
import { reportCount, reported, reportedRules } from "./lint-harness.ts";
import { replacementFor, retiredPackages } from "./retired-packages.ts";
import {
  handRolledServerReadMessage,
  queryOptionsPlacementMessage,
  retiredPackagesFromStateKinds,
  serverStateRetiredPackages,
  stateKinds,
} from "./state-kinds.ts";

describe("state-kinds", () => {
  it("names TanStack Query as the server-state mechanism", () => {
    expect.hasAssertions();
    expect(stateKinds.server.mechanism).toContain("TanStack Query");
  });

  it("keeps oxlint rule messages aligned with the state-kind table", () => {
    expect.hasAssertions();
    expect(noHandRolledServerRead.meta.messages.handRolledServerRead).toContain(
      handRolledServerReadMessage,
    );
    expect(requireQueryOptionsInApiSegment.meta.messages.queryOptionsOutsideApi).toContain(
      queryOptionsPlacementMessage,
    );
  });

  it.for(Object.keys(serverStateRetiredPackages))(
    "retires competing server-state package %s toward TanStack Query",
    (dependency) => {
      expect.hasAssertions();
      expect(replacementFor(dependency)).toContain("TanStack Query");
      expect(retiredPackages[dependency] ?? replacementFor(dependency)).toContain("TanStack Query");
    },
  );

  it("keeps state-kind retirements inside the retired package table", () => {
    expect.hasAssertions();
    expect(Object.keys(retiredPackagesFromStateKinds()).sort()).toStrictEqual(
      Object.keys(serverStateRetiredPackages).sort(),
    );
    for (const [dependency, replacement] of Object.entries(retiredPackagesFromStateKinds())) {
      expect(retiredPackages[dependency]).toBe(replacement);
    }
  });
});

describe("atom-server-data", () => {
  const serverDataInAtoms = [
    [
      "fetch-in-make",
      "libs/ui/src/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.make(Effect.promise(() => fetch("/api/session")));',
    ],
    [
      "fetch-in-local-function",
      "apps/service-member/src/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; async function load() { return (await fetch("/x")).json(); } export const a = Atom.make(Effect.promise(load));',
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

  it.for(serverDataInAtoms)("rejects server data held in atoms: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("atom-server-data", { code, filename: name })).toBe(true);
  });

  it("reports a refresh member once", () => {
    expect.hasAssertions();
    expect(
      reportCount("atom-server-data", {
        code: 'import { Atom } from "effect/unstable/reactivity"; export const r = Atom.refresh;',
        filename: "libs/ui/src/probe.ts",
      }),
    ).toBe(1);
  });

  it.for([
    [
      "derived-effect",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.make(Effect.succeed(1));',
    ],
    [
      "plain-make",
      'import { Atom } from "effect/unstable/reactivity"; export const open = Atom.make(false);',
    ],
  ])("allows non-server Atom usage: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: "libs/ui/src/probe.ts" })).toStrictEqual([]);
  });
});

describe("retired server-state imports", () => {
  it.for([
    ["swr", 'export * from "swr";'],
    ["urql", 'export * from "urql";'],
    ["@apollo/client", 'export * from "@apollo/client";'],
    ["react-relay", 'export * from "react-relay";'],
    [
      "@trpc/client",
      'import { createTRPCClient } from "@trpc/client"; export { createTRPCClient };',
    ],
    ["react-query", 'export * from "react-query";'],
  ])("rejects %s imports", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("retired-imports", { code, filename: "libs/ui/src/probe.ts" })).toBe(true);
  });
});
