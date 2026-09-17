import { describe, expect, it } from "vite-plus/test";
import { reported, reportedRules, ruleNames } from "./lint-harness.ts";
import { field } from "./dependencies.ts";
import plugin from "./rules.ts";

const configs: Readonly<Record<string, unknown>> = import.meta.glob("../../vite.config.ts", {
  eager: true,
  import: "default",
});

const forbiddenCode = [
  ["apps/user/probe.ts", 'import "../admin/private.ts";', "boundaries"],
  ["libs/shared/probe.ts", 'import "../../apps/admin/private.ts";', "boundaries"],
  ["infra/cloudflare/probe.ts", 'import "../../tools/dev/src/cli.ts";', "boundaries"],
  [
    "apps/user/probe.ts",
    'import { vi } from "vitest"; vi.mock("owned-module");',
    "no-internal-mocks",
  ],
  ["apps/user/probe.ts", 'console.log(process.env["SECRET"]);', "environment-boundary"],
  [
    "libs/observability/src/server.ts",
    'export const send = () => fetch("http://collector", { redirect: "error" });',
    "worker-fetch",
  ],
  [
    "infra/budget-monitor/src/billing.ts",
    'const mode = "error"; export const send = () => fetch("https://api", { redirect: mode });',
    "worker-fetch",
  ],
  [
    "infra/error-monitor/src/telemetry.ts",
    'export const send = () => fetch("https://api", { redirect: "error" });',
    "worker-fetch",
  ],
  [
    "libs/shared/src/probe.ts",
    'import * as v from "valibot"; export const schema = v.string();',
    "effect-stack",
  ],
  [
    "apps/user/src/api.ts",
    'import { Elysia } from "elysia"; export const api = new Elysia();',
    "effect-stack",
  ],
  [
    "apps/user/src/routes/api.probe.ts",
    "export const Route = { server: { handlers: { GET: () => new Response() } } };",
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    "export const Route = { server: { handlers: { GET: () => new Response() } } };",
    "effect-stack",
  ],
  [
    "libs/shared/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { if (Effect) throw new Error("x"); };',
    "effect-failures",
  ],
  [
    "infra/budget-monitor/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { try { return Effect; } catch { return undefined; } };',
    "effect-failures",
  ],
  ["libs/db/src/admin.ts", 'import "./bootstrap-statement.ts";', "boundaries"],
] as const;

const dependencyBypasses = [
  ["static-db-admin", "apps/user/src/probe.ts", 'import "@template/db/admin";'],
  ["user-remote", "apps/user/src/probe.ts", 'export * from "@template/db/remote";'],
  ["admin-remote", "apps/admin/src/probe.ts", 'export * from "@template/db/remote";'],
  [
    "admin-remote-dynamic",
    "apps/admin/src/probe.ts",
    'export const load = () => import("@template/db/remote");',
  ],
  [
    "user-remote-require",
    "apps/user/src/probe.ts",
    'export const remote = require("@template/db/remote");',
  ],
  ["shared-remote-laundering", "libs/auth/src/probe.ts", 'export * from "@template/db/remote";'],
  ["db-root-remote-laundering", "libs/db/src/index.ts", 'export * from "./remote";'],
  ["db-root-bootstrap-laundering", "libs/db/src/index.ts", 'export * from "./bootstrap-local";'],
  ["db-root-testing-laundering", "libs/db/src/index.ts", 'export * from "./testing";'],
  [
    "user-relative-remote",
    "apps/user/src/probe.ts",
    'export * from "../../../libs/db/src/remote";',
  ],
  [
    "admin-relative-remote",
    "apps/admin/src/probe.ts",
    'export * from "../../../libs/db/src/remote-operations";',
  ],
  [
    "user-relative-bootstrap",
    "apps/user/src/probe.ts",
    'import "../../../libs/db/src/bootstrap-local";',
  ],
  [
    "admin-relative-bootstrap",
    "apps/admin/src/probe.ts",
    'import "../../../libs/db/src/bootstrap-local";',
  ],
  [
    "user-relative-testing",
    "apps/user/src/probe.ts",
    'export * from "../../../libs/db/src/testing";',
  ],
  [
    "admin-relative-testing",
    "apps/admin/src/probe.ts",
    'export * from "../../../libs/db/src/testing";',
  ],
  ["admin-testing-entry", "apps/admin/src/probe.ts", 'import "@template/db/testing";'],
  [
    "type-import",
    "apps/user/src/probe.ts",
    'export type Admin = typeof import("@template/db/admin");',
  ],
  ["named-private-entry", "apps/user/src/probe.ts", 'import "@template/db/src/schema";'],
  ["extensionless-test", "apps/user/src/probe.ts", 'export * from "./helper.test";'],
  ["named-reexport", "apps/user/src/probe.ts", 'export { deleteUser } from "@template/db/admin";'],
  ["star-reexport", "apps/user/src/probe.ts", 'export * from "@template/db/admin";'],
  ["namespace-reexport", "apps/user/src/probe.ts", 'export * as admin from "@template/db/admin";'],
  [
    "dynamic-import",
    "apps/user/src/probe.ts",
    'export const load = () => import("@template/db/admin");',
  ],
  [
    "constant-import",
    "apps/user/src/probe.ts",
    'const target = "@template/db/" + "admin"; export const load = () => import(target);',
  ],
  [
    "template-import",
    "apps/user/src/probe.ts",
    "export const load = () => import(`@template/db/admin`);",
  ],
  [
    "unknown-import",
    "apps/user/src/probe.ts",
    "export const load = (target: string) => import(target);",
  ],
  ["require", "apps/user/src/probe.ts", 'export const admin = require("@template/db/admin");'],
  [
    "require-alias",
    "apps/user/src/probe.ts",
    'const load = require; export const admin = load("@template/db/admin");',
  ],
  [
    "create-require",
    "apps/user/src/probe.ts",
    'import { createRequire as factory } from "node:module"; const load = factory(import.meta.url); export const admin = load("@template/db/admin");',
  ],
  [
    "import-equals",
    "apps/user/src/probe.ts",
    'import admin = require("@template/db/admin"); export { admin };',
  ],
  ["relative-admin", "apps/user/src/probe.ts", 'export * from "../../admin/src/server";'],
  ["relative-db-admin", "apps/user/src/probe.ts", 'export * from "../../../libs/db/src/admin";'],
  ["relative-package-private", "apps/user/src/probe.ts", 'import "../../../libs/db/src/schema";'],
  ["shared-laundering", "libs/shared/src/probe.ts", 'export * from "@template/db/admin";'],
  ["db-root-laundering", "libs/db/src/index.ts", 'export * from "./admin";'],
  ["shared-app-alias", "libs/shared/src/probe.ts", 'import "@template/admin";'],
  ["shared-user-app", "libs/shared/src/probe.ts", 'import "@template/user";'],
  ["app-driver", "apps/user/src/probe.ts", 'export * from "drizzle-orm";'],
  ["dynamic-driver", "libs/auth/src/probe.ts", 'export const load = () => import("node:sqlite");'],
  ["production-test-entry", "apps/user/src/probe.ts", 'import "@template/db/testing";'],
  ["admin-signup", "apps/admin/src/probe.ts", 'import "@template/ui/signup";'],
  ["wiki-database", "apps/wiki/src/probe.ts", 'import "@template/db";'],
  [
    "wiki-signup",
    "apps/wiki/src/probe.ts",
    'export const load = () => import("@template/ui/signup");',
  ],
  ["wiki-app", "apps/user/src/probe.ts", 'import "@template/wiki";'],
] as const;

const validBoundaries = [
  ["apps/admin/src/probe.ts", 'export * from "@template/db/admin";'],
  ["libs/ui/src/probe.ts", 'export const send = () => fetch("/api", { redirect: "error" });'],
  ["tools/dev/src/probe.ts", 'export * from "@template/db/remote";'],
  ["infra/cloudflare/src/probe.ts", 'export * from "@template/db/remote";'],
  ["libs/db/src/remote.ts", 'export * from "./remote-operations";'],
  ["apps/user/src/app/probe.ts", 'export * from "@template/db";'],
  ["apps/user/src/app/probe.ts", 'export * from "@template/ui/signup";'],
  ["apps/wiki/vite.config.ts", 'export { localDatabase } from "@template/db/local";'],
  ["apps/wiki/src/probe.ts", 'export * from "@template/auth";'],
  ["apps/user/src/app/probe.ts", 'export const load = () => import("./feature");'],
  ["libs/shared/src/probe.ts", "export const fn = (process: { env: string }) => process.env;"],
  ["libs/shared/src/probe.ts", "export const fn = (vi: { mock: () => number }) => vi.mock();"],
  ["libs/shared/src/probe.ts", "export const location = import.meta.url;"],
  ["libs/shared/src/probe.ts", 'export { http } from "msw";'],
  ["libs/config/src/probe.ts", "export const value = process.env;"],
  ["libs/config/src/probe.ts", "export const value = import.meta.env;"],
  ["infra/cloudflare/src/probe.ts", "export const value = process.env;"],
  ["tools/observe/src/probe.ts", "export const value = process.env;"],
  ["libs/db/src/probe.ts", 'export * from "drizzle-orm";'],
  ["libs/auth/src/probe.test.ts", 'export * from "@template/db/admin";'],
  ["libs/auth/src/probe-fixture.ts", 'export * from "@template/db/testing";'],
] as const;

describe("project lint rules on dependency boundaries", () => {
  it("every project rule is tested and enabled", () => {
    expect.hasAssertions();
    expect(Object.keys(plugin.rules).toSorted()).toStrictEqual([...ruleNames].toSorted());
    expect(field(field(configs["../../vite.config.ts"], "lint"), "rules")).toMatchObject(
      Object.fromEntries(ruleNames.map((rule) => [`project/${rule}`, "error"])),
    );
  });

  it.for(forbiddenCode)("rejects forbidden code in %s", ([name, code, rule]) => {
    expect.hasAssertions();
    expect(reported(rule, name, code)).toBe(true);
  });

  it.for(dependencyBypasses)("rejects dependency bypass: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", name, code)).toBe(true);
  });

  it.for(validBoundaries)("allows valid boundary in %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules(name, code)).toStrictEqual([]);
  });

  it("allows shared pure code", () => {
    expect.hasAssertions();
    expect(
      reportedRules("valid.ts", "export const add = (a: number, b: number) => a + b;\n"),
    ).toStrictEqual([]);
  });
});
