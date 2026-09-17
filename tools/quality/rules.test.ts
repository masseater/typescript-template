import { describe, expect, it } from "vitest";
import { lintProbe } from "./lint-harness.ts";

const forbiddenCode = [
  ["apps/user/probe.ts", 'import "../admin/private.ts";', "project(boundaries)"],
  ["libs/shared/probe.ts", 'import "../../apps/admin/private.ts";', "project(boundaries)"],
  ["infra/cloudflare/probe.ts", 'import "../../tools/dev/src/cli.ts";', "project(boundaries)"],
  [
    "apps/user/probe.ts",
    'import { vi } from "vitest"; vi.mock("owned-module");',
    "project(no-internal-mocks)",
  ],
  ["apps/user/probe.ts", 'console.log(process.env["SECRET"]);', "project(environment-boundary)"],
  [
    "libs/observability/src/server.ts",
    'export const send = () => fetch("http://collector", { redirect: "error" });',
    "project(worker-fetch)",
  ],
  [
    "infra/budget-monitor/src/billing.ts",
    'const mode = "error"; export const send = () => fetch("https://api", { redirect: mode });',
    "project(worker-fetch)",
  ],
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
  ["wiki-auth", "apps/wiki/src/probe.ts", 'export const load = () => import("@template/auth");'],
  ["wiki-app", "apps/user/src/probe.ts", 'import "@template/wiki";'],
] as const;

const validBoundaries = [
  ["apps/admin/src/probe.ts", 'export * from "@template/db/admin";'],
  ["libs/ui/src/probe.ts", 'export const send = () => fetch("/api", { redirect: "error" });'],
  ["tools/dev/src/probe.ts", 'export * from "@template/db/remote";'],
  ["infra/cloudflare/src/probe.ts", 'export * from "@template/db/remote";'],
  ["libs/db/src/remote.ts", 'export * from "./remote-operations";'],
  ["apps/user/src/probe.ts", 'export * from "@template/db";'],
  ["apps/user/src/probe.ts", 'export * from "@template/ui/signup";'],
  ["apps/user/src/probe.ts", 'export const load = () => import("./feature");'],
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
] as const;

describe("project lint rules on dependency boundaries", () => {
  it.for(forbiddenCode)("rejects forbidden code in %s", async ([name, code, diagnostic]) => {
    expect.hasAssertions();
    const result = await lintProbe(name, code);
    expect(result.status).toBe(1);
    expect(result.output).toContain(diagnostic);
  });

  it.for(dependencyBypasses)("rejects dependency bypass: %s", async ([_label, name, code]) => {
    expect.hasAssertions();
    const result = await lintProbe(name, code);
    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("project(boundaries)");
  });

  it.for(validBoundaries)("allows valid boundary in %s", async ([name, code]) => {
    expect.hasAssertions();
    const result = await lintProbe(name, code);
    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(0);
  });

  it("allows shared pure code", async () => {
    expect.assertions(1);
    const result = await lintProbe(
      "valid.ts",
      "export const add = (a: number, b: number) => a + b;\n",
    );
    expect({ error: result.error, status: result.status }).toStrictEqual({
      error: undefined,
      status: 0,
    });
  });
});
