import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { reportCount, reported, reportedRules, ruleNames } from "./lint-harness.ts";
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
    "libs/ui/src/probe.ts",
    'import { useCallback } from "react"; export const fn = () => useCallback(() => 0, []);',
    "no-manual-memoization",
  ],
  [
    "libs/ui/src/probe.ts",
    'import React from "react"; export const Panel = React.memo(() => null);',
    "no-manual-memoization",
  ],
  [
    "libs/ui/src/probe.ts",
    'import * as React from "react"; export const Panel = React.memo(() => null);',
    "no-manual-memoization",
  ],
  [
    "apps/user/src/probe.ts",
    'import { useMemo as cache } from "react"; export const fn = () => cache(() => 0, []);',
    "no-manual-memoization",
  ],
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
    'import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute("/api/$")({ server: { handlers: { GET: () => new Response() } } });',
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute("/api/$")({ server: { handlers: { GET: () => new Response() } } });',
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { ownServer } from "../own.ts"; export const Route = createFileRoute("/api/$")({ server: ownServer() });',
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { own } from "../own.ts"; export const Route = createFileRoute("/api/$")({ ...own });',
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: { handlers: userApi } });',
    "effect-stack",
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { ownServer } from "../own.ts"; export const Route = createFileRoute("/api/$")({ server: { ...ownServer(), middleware: [] } });',
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
  ["static-db-admin", "apps/user/src/probe.ts", 'import "@repo/db/admin";'],
  ["user-remote", "apps/user/src/probe.ts", 'export * from "@repo/db/remote";'],
  ["admin-remote", "apps/admin/src/app/probe.ts", 'export * from "@repo/db/remote";'],
  [
    "admin-remote-dynamic",
    "apps/admin/src/app/probe.ts",
    'export const load = () => import("@repo/db/remote");',
  ],
  [
    "user-remote-require",
    "apps/user/src/probe.ts",
    'export const remote = require("@repo/db/remote");',
  ],
  ["shared-remote-laundering", "libs/auth/src/probe.ts", 'export * from "@repo/db/remote";'],
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
    "apps/admin/src/app/probe.ts",
    'export * from "../../../libs/db/src/remote-operations";',
  ],
  [
    "user-relative-bootstrap",
    "apps/user/src/probe.ts",
    'import "../../../libs/db/src/bootstrap-local";',
  ],
  [
    "admin-relative-bootstrap",
    "apps/admin/src/app/probe.ts",
    'import "../../../libs/db/src/bootstrap-local";',
  ],
  [
    "user-relative-testing",
    "apps/user/src/probe.ts",
    'export * from "../../../libs/db/src/testing";',
  ],
  [
    "admin-relative-testing",
    "apps/admin/src/app/probe.ts",
    'export * from "../../../libs/db/src/testing";',
  ],
  ["admin-testing-entry", "apps/admin/src/app/probe.ts", 'import "@repo/db/testing";'],
  ["type-import", "apps/user/src/probe.ts", 'export type Admin = typeof import("@repo/db/admin");'],
  ["named-private-entry", "apps/user/src/probe.ts", 'import "@repo/db/src/schema";'],
  ["extensionless-test", "apps/user/src/probe.ts", 'export * from "./helper.test";'],
  ["named-reexport", "apps/user/src/probe.ts", 'export { deleteUser } from "@repo/db/admin";'],
  ["star-reexport", "apps/user/src/probe.ts", 'export * from "@repo/db/admin";'],
  ["namespace-reexport", "apps/user/src/probe.ts", 'export * as admin from "@repo/db/admin";'],
  [
    "dynamic-import",
    "apps/user/src/probe.ts",
    'export const load = () => import("@repo/db/admin");',
  ],
  [
    "constant-import",
    "apps/user/src/probe.ts",
    'const target = "@repo/db/" + "admin"; export const load = () => import(target);',
  ],
  [
    "template-import",
    "apps/user/src/probe.ts",
    "export const load = () => import(`@repo/db/admin`);",
  ],
  [
    "unknown-import",
    "apps/user/src/probe.ts",
    "export const load = (target: string) => import(target);",
  ],
  ["require", "apps/user/src/probe.ts", 'export const admin = require("@repo/db/admin");'],
  [
    "require-alias",
    "apps/user/src/probe.ts",
    'const load = require; export const admin = load("@repo/db/admin");',
  ],
  [
    "create-require",
    "apps/user/src/probe.ts",
    'import { createRequire as factory } from "node:module"; const load = factory(import.meta.url); export const admin = load("@repo/db/admin");',
  ],
  [
    "import-equals",
    "apps/user/src/probe.ts",
    'import admin = require("@repo/db/admin"); export { admin };',
  ],
  ["relative-admin", "apps/user/src/probe.ts", 'export * from "../../admin/src/server";'],
  ["relative-db-admin", "apps/user/src/probe.ts", 'export * from "../../../libs/db/src/admin";'],
  ["relative-package-private", "apps/user/src/probe.ts", 'import "../../../libs/db/src/schema";'],
  ["shared-laundering", "libs/shared/src/probe.ts", 'export * from "@repo/db/admin";'],
  ["db-root-laundering", "libs/db/src/index.ts", 'export * from "./admin";'],
  ["shared-app-alias", "libs/shared/src/probe.ts", 'import "@repo/admin";'],
  ["shared-user-app", "libs/shared/src/probe.ts", 'import "@repo/user";'],
  ["app-driver", "apps/user/src/probe.ts", 'export * from "drizzle-orm";'],
  ["dynamic-driver", "libs/auth/src/probe.ts", 'export const load = () => import("node:sqlite");'],
  ["production-test-entry", "apps/user/src/probe.ts", 'import "@repo/db/testing";'],
  ["observability-test-entry", "libs/auth/src/probe.ts", 'import "@repo/observability/testing";'],
  ["admin-signup", "apps/admin/src/app/probe.ts", 'import "@repo/ui/signup";'],
  ["wiki-database", "apps/wiki/src/app/probe.ts", 'import "@repo/db";'],
  [
    "wiki-signup",
    "apps/wiki/src/app/probe.ts",
    'export const load = () => import("@repo/ui/signup");',
  ],
  ["wiki-app", "apps/user/src/probe.ts", 'import "@repo/wiki";'],
] as const;

const validBoundaries = [
  ["apps/admin/src/app/probe.ts", 'export * from "@repo/db/admin";'],
  ["libs/ui/src/probe.ts", 'export const send = () => fetch("/api", { redirect: "error" });'],
  ["tools/dev/src/probe.ts", 'export * from "@repo/db/remote";'],
  ["infra/cloudflare/src/probe.ts", 'export * from "@repo/db/remote";'],
  ["libs/db/src/remote.ts", 'export * from "./remote-operations";'],
  ["apps/user/src/app/probe.ts", 'export * from "@repo/db";'],
  ["apps/user/src/app/probe.ts", 'export * from "@repo/ui/signup";'],
  ["apps/wiki/vite.config.ts", 'export { localDatabase } from "@repo/db/local";'],
  ["apps/wiki/src/app/probe.ts", 'export * from "@repo/auth";'],
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
  ["libs/auth/src/probe.test.ts", 'export * from "@repo/db/admin";'],
  ["libs/auth/src/probe-fixture.ts", 'export * from "@repo/db/testing";'],
  ["libs/runtime/src/probe.test.ts", 'export * from "@repo/observability/testing";'],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { elysiaServer } from "@repo/runtime/http"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: elysiaServer(userApi) });',
  ],
  [
    "apps/user/src/app/routes/api.probe.ts",
    'import { createFileRoute } from "@tanstack/react-router"; import { elysiaServer } from "@repo/runtime/http"; import { userApi } from "../api.ts"; export const Route = createFileRoute("/api/$")({ server: { ...elysiaServer(userApi), middleware: [] } });',
  ],
  ["apps/user/src/app/routes/probe.ts", "export const config = { server: { port: 1 } };"],
] as const;

const singleReports = [
  [
    "no-manual-memoization",
    'import React from "react"; export const Panel = React.memo(() => null);',
  ],
  ["no-internal-mocks", 'import vitest from "vitest"; vitest.mock("owned-module");'],
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

  it.for(singleReports)("reports a default import member call once: %s", ([rule, code]) => {
    expect.hasAssertions();
    expect(reportCount(rule, "libs/ui/src/probe.ts", code)).toBe(1);
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
