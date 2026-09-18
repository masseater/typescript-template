import { describe, expect, it } from "vite-plus/test";
import { reported, reportedRules } from "./lint-harness.ts";

const forbiddenStacks = [
  ["libs/shared/src/probe.ts", 'import * as v from "valibot"; export const schema = v.string();'],
  ["libs/shared/src/probe.ts", 'export * from "elysia";'],
  ["libs/shared/src/probe.ts", 'export { t } from "elysia";'],
  [
    "libs/shared/src/probe.ts",
    'export const load = () => import("elysia/adapter/cloudflare-worker");',
  ],
  ["libs/shared/src/probe.ts", 'import type { Infer } from "valibot"; export type T = Infer;'],
  ["apps/user/src/api.ts", 'import { Elysia } from "elysia"; export const api = new Elysia();'],
  [
    "apps/user/src/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute("/api/$")({ server: { handlers: { GET: () => new Response() } } });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute("/api/$")({ server: { handlers: { GET: () => new Response() } } });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { ownServer } from "../own.ts"; export const Route = createFileRoute("/api/$")({ server: ownServer() });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { own } from "../own.ts"; export const Route = createFileRoute("/api/$")({ ...own });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: { handlers: userApi } });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { ownServer } from "../own.ts"; export const Route = createFileRoute("/api/$")({ server: { ...ownServer(), middleware: [] } });',
  ],
] as const;

const allowedStacks = [
  ["libs/runtime/src/http.ts", 'import { Elysia } from "elysia"; export const api = new Elysia();'],
  ["libs/shared/src/probe.ts", 'import type { Elysia } from "elysia"; export type Api = Elysia;'],
  ["libs/shared/src/probe.ts", 'export { helper } from "pre-elysia";'],
  ["libs/shared/src/probe.ts", 'export { helper } from "my-valibot";'],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { elysiaServer } from "@template/runtime/http"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: elysiaServer(userApi) });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { elysiaServer } from "@template/runtime/http"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: { ...elysiaServer(userApi), middleware: [] } });',
  ],
  ["apps/user/src/app/routes/probe.ts", "export const config = { server: { port: 1 } };"],
] as const;

describe("the Effect stack boundary", () => {
  it.for(forbiddenStacks)("rejects %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reported("effect-stack", name, code)).toBe(true);
  });

  it.for(allowedStacks)("allows %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules(name, code)).toStrictEqual([]);
  });
});
