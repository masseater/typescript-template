import { describe, expect, it } from "vite-plus/test";
import { reported, reportedRules } from "./lint-harness.ts";

const forbiddenStacks = [
  ["star-reexport", "libs/shared/src/probe.ts", 'export * from "elysia";'],
  ["named-reexport", "libs/shared/src/probe.ts", 'export { t } from "elysia";'],
  [
    "dynamic-adapter",
    "libs/shared/src/probe.ts",
    'export const load = () => import("elysia/adapter/cloudflare-worker");',
  ],
  [
    "type-only-valibot",
    "libs/shared/src/probe.ts",
    'import type { Infer } from "valibot"; export type T = Infer;',
  ],
] as const;

const allowedStacks = [
  ["libs/runtime/src/http.ts", 'import { Elysia } from "elysia"; export const api = new Elysia();'],
  ["libs/shared/src/probe.ts", 'import type { Elysia } from "elysia"; export type Api = Elysia;'],
  ["libs/shared/src/probe.ts", 'export { helper } from "pre-elysia";'],
  ["libs/shared/src/probe.ts", 'export { helper } from "my-valibot";'],
] as const;

describe("the Effect stack boundary", () => {
  it.for(forbiddenStacks)("rejects %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("effect-stack", name, code)).toBe(true);
  });

  it.for(allowedStacks)("allows %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules(name, code)).toStrictEqual([]);
  });
});
