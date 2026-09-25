import { describe, expect, it } from "vite-plus/test";

import { reportCount, reported, reportedRules } from "./lint-harness-test-fixture.ts";
import { replacementFor, retiredPackages } from "./retired-packages.ts";
import { retiredPackagesFromStateKinds, stateKinds } from "./state-kinds.ts";

describe("state-kinds", () => {
  it("names TanStack Query as the server-state mechanism", () => {
    expect.hasAssertions();
    expect(stateKinds.server.mechanism).toContain("TanStack Query");
  });

  it.for(Object.keys(stateKinds.server.retiredPackages))(
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
      Object.keys(stateKinds.server.retiredPackages).sort(),
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
      "libs/ui/src/features/ui/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.make(Effect.promise(() => fetch("/api/session")));',
    ],
    [
      "fetch-in-local-function",
      "apps/service-member/src/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; async function load() { return (await fetch("/x")).json(); } export const a = Atom.make(Effect.promise(load));',
    ],
    [
      "atom-refresh-hook",
      "libs/ui/src/features/ui/probe.ts",
      'import { useAtomRefresh } from "@effect/atom-react"; export const r = useAtomRefresh;',
    ],
    [
      "atom-refresh-member",
      "libs/ui/src/features/ui/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; export const r = Atom.refreshOnWindowFocus;',
    ],
    [
      "reactivity-service",
      "libs/ui/src/features/ui/probe.ts",
      'import { Reactivity } from "effect/unstable/reactivity"; export const r = Reactivity;',
    ],
    [
      "atom-http-api",
      "libs/ui/src/features/ui/probe.ts",
      'import { AtomHttpApi } from "effect/unstable/reactivity"; export const r = AtomHttpApi;',
    ],
    [
      "fetch-in-fn",
      "libs/ui/src/features/ui/probe.ts",
      'import { Atom } from "effect/unstable/reactivity"; import { Effect } from "effect"; export const a = Atom.fn((id: string) => Effect.promise(() => fetch(`/api/items/${id}`)));',
    ],
    [
      "api-segment-read-in-fn",
      "apps/internal-dashboard/src/pages/inquiries/model/probe.ts",
      'import { request } from "@repo/ui"; import { Atom } from "effect/unstable/reactivity"; import { loadInquiry } from "#pages/inquiries/api/inquiries.ts"; export const a = Atom.fn((inquiryId: string) => request(() => loadInquiry(inquiryId)));',
    ],
    [
      "api-segment-read-in-family-fn",
      "apps/internal-dashboard/src/pages/inquiries/model/probe.ts",
      'import { request } from "@repo/ui"; import { Atom } from "effect/unstable/reactivity"; import { loadInquiry } from "#pages/inquiries/api/inquiries.ts"; export const a = Atom.family((slot: string) => Atom.fn(() => request(() => loadInquiry(slot))));',
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
        filename: "libs/ui/src/features/ui/probe.ts",
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
    [
      "fn-running-a-given-task",
      'import { Atom } from "effect/unstable/reactivity"; import { Semaphore } from "effect"; import { request } from "./request"; const gate = Semaphore.makeUnsafe(1); export const a = Atom.fn(({ task }: { task: () => Promise<void> }) => gate.withPermits(1)(request(task)), { concurrent: true });',
    ],
  ] as const)("allows non-server Atom usage: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(
      reportedRules({ code: code ?? "", filename: "libs/ui/src/features/ui/probe.ts" }),
    ).toStrictEqual([]);
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
  ] as const)("rejects %s imports", ([_label, code]) => {
    expect.hasAssertions();
    expect(
      reported("retired-imports", {
        code: code ?? "",
        filename: "libs/ui/src/features/ui/probe.ts",
      }),
    ).toBe(true);
  });
});
