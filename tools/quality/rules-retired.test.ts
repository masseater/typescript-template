import { describe, expect, it } from "vite-plus/test";
import { reported } from "./lint-harness.ts";

const retiredImports = [
  ["package", 'import { create } from "zustand"; export const store = create;'],
  ["deep-subpath", 'export { immer } from "zustand/middleware/immer";'],
  ["scoped-prefix", 'export * from "@reduxjs/toolkit/query/react";'],
  ["dynamic", 'export const load = () => import("jotai");'],
  ["require", 'export const store = require("valtio");'],
  ["type-only", 'export type Store = import("@tanstack/store").Store<number>;'],
  ["design-system", 'import "smarthr-ui";'],
  ["auth-react-entry", 'export { createAuthClient } from "better-auth/react";'],
  ["atom-react-subpath", 'export { make } from "@effect/atom-react/ScopedAtom";'],
  ["reactivity-subpath", 'export * as Atom from "effect/unstable/reactivity/Atom";'],
  ["swr", 'import useSWR from "swr"; export const read = useSWR;'],
  ["swr-subpath", 'export { default } from "swr/infinite";'],
  ["legacy-react-query", 'export { useQuery } from "react-query";'],
  ["urql", 'export { useQuery } from "urql";'],
  ["apollo", 'export { useQuery } from "@apollo/client";'],
  ["relay", 'export { useLazyLoadQuery } from "react-relay";'],
  ["trpc", 'export { createTRPCReact } from "@trpc/react-query";'],
] as const;

const allowedImports = [
  ["atom-react-root", 'export { useAtom } from "@effect/atom-react";'],
  ["reactivity-root", 'export { Atom } from "effect/unstable/reactivity";'],
  ["auth-client-entry", 'export { createAuthClient } from "better-auth/client";'],
  ["similar-name", 'export * from "zustandx";'],
  ["similar-prefix", 'export * from "jotai-tanstack-query";'],
  ["server-state", 'export * from "@tanstack/react-query";'],
  ["forms", 'export * from "@tanstack/react-form";'],
] as const;

describe("retired imports", () => {
  it.for(retiredImports)("rejects %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", "libs/ui/src/probe.ts", code)).toBe(true);
  });

  it.for(allowedImports)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", "libs/ui/src/probe.ts", code)).toBe(false);
  });
});
