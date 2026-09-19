import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { reportCount, reported, reportedRules, ruleNames } from "./lint-harness.ts";
import { configuredLintRules } from "./lint.ts";
import plugin from "./plugin.ts";

const configs: Readonly<Record<string, unknown>> = import.meta.glob("../../vite.config.ts", {
  eager: true,
  import: "default",
});

const forbiddenCode = [
  [
    "apps/user/src/probe.ts",
    "export const load = (target: string) => import(target);",
    "boundaries",
  ],
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
  ["libs/ui/src/probe.ts", 'export * from "styled-components";', "retired-imports"],
  [
    "apps/user/src/probe.ts",
    'export { ThemeProvider } from "styled-components/native";',
    "retired-imports",
  ],
  ["infra/cloudflare/src/probe.ts", 'export * from "@pulumi/aws";', "retired-imports"],
  [
    "tools/dev/src/probe.ts",
    'import legacy = require("react-intl"); export { legacy };',
    "retired-imports",
  ],
  ["tools/dev/src/probe.ts", 'export const load = () => import("react-intl");', "retired-imports"],
  [
    "tools/dev/src/probe.ts",
    "export const done = () => { process.exitCode = 0; };",
    "process-boundary",
  ],
  [
    "tools/dev/src/probe.ts",
    "export const code = () => globalThis.process.stdout;",
    "process-boundary",
  ],
  [
    "tools/dev/src/probe.ts",
    "export const write = (line: string) => process.stderr.write(line);",
    "process-boundary",
  ],
  [
    "tools/dev/src/probe.ts",
    "const { exitCode } = process; export const code = () => exitCode;",
    "process-boundary",
  ],
  [
    "tools/dev/src/probe.ts",
    'import { stdout } from "node:process"; export const write = () => stdout.write("x");',
    "process-boundary",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { NodeRuntime as runtime } from "@effect/platform-node"; export const start = () => runtime.runMain(0);',
    "process-boundary",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { runMain } from "@effect/platform-node/NodeRuntime"; export const start = () => runMain(0);',
    "process-boundary",
  ],
  [
    "libs/config/src/cli.ts",
    "export const write = (line: string) => process.stdout.write(line);",
    "process-boundary",
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
    'import { Effect } from "effect"; export const run = () => { if (Effect) throw new Error("x"); };',
    "effect-failures",
  ],
  [
    "infra/budget-monitor/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { try { return Effect; } catch { return undefined; } };',
    "effect-failures",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { Effect } from "effect"; export const run = Effect.void.pipe(Effect.annotateLogs({ a: "b" }));',
    "annotations",
  ],
  [
    "apps/user/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => Effect.annotateCurrentSpan({ a: "b" });',
    "annotations",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { annotateSpans } from "effect/Effect"; export const run = () => annotateSpans;',
    "annotations",
  ],
  [
    "tools/observe/src/probe.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withLogSpan(e, "x");',
    "annotations",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withSpan(e, "x");',
    "annotations",
  ],
  [
    "apps/user/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => Effect.logError("boom");',
    "logs",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { logWarning } from "effect/Effect"; export const run = () => logWarning;',
    "logs",
  ],
  [
    "apps/user/src/probe.ts",
    'export const mark = (span: { attribute: (key: string, value: string) => void }) => span.attribute("a", "b");',
    "span-mutation",
  ],
  [
    "libs/runtime/src/probe.ts",
    'export const mark = (span: { event: (name: string) => void }) => span.event("x");',
    "span-mutation",
  ],
  [
    "apps/user/src/probe.ts",
    'import { ManagedRuntime } from "effect"; export const run = () => ManagedRuntime;',
    "cross-request-state",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { Effect } from "effect"; export const cache = () => Effect.cachedWithTTL(Effect.void, "1 minute");',
    "cross-request-state",
  ],
  [
    "libs/runtime/src/probe.ts",
    'import { cachedWithTTL } from "effect/Effect"; export const cache = () => cachedWithTTL;',
    "cross-request-state",
  ],
  [
    "apps/admin/src/probe.ts",
    'import { RcMap } from "effect"; export const shared = () => RcMap;',
    "cross-request-state",
  ],
] as const;

const opaqueSpecifiers = [
  [
    "concatenated",
    "apps/user/src/probe.ts",
    'const target = "@repo/db/" + "admin"; export const load = () => import(target);',
  ],
  ["template", "apps/user/src/probe.ts", "export const load = () => import(`@repo/db/admin`);"],
  [
    "variable",
    "apps/user/src/probe.ts",
    'const target = "@repo/db/admin"; export const load = () => import(target);',
  ],
  ["unknown", "apps/user/src/probe.ts", "export const load = (target: string) => import(target);"],
  ["require", "libs/auth/src/probe.ts", 'export const admin = require("@repo/db/admin");'],
  [
    "require-alias",
    "libs/auth/src/probe.ts",
    'const load = require; export const admin = load("@repo/db/admin");',
  ],
  [
    "create-require",
    "libs/auth/src/probe.ts",
    'import { createRequire as factory } from "node:module"; export const load = factory(import.meta.url);',
  ],
  [
    "import-equals",
    "apps/user/src/probe.ts",
    'import admin = require("@repo/db/admin"); export { admin };',
  ],
] as const;

const validBoundaries = [
  ["apps/admin/src/app/probe.ts", 'export * from "@repo/db/admin";'],
  ["apps/user/src/app/probe.ts", 'export * from "@repo/db/admin";'],
  ["apps/user/src/app/probe.ts", 'import "@repo/db/src/schema";'],
  ["libs/ui/src/probe.ts", 'export const send = () => fetch("/api", { redirect: "error" });'],
  ["tools/dev/src/probe.ts", 'export * from "@repo/db/remote";'],
  ["infra/cloudflare/src/probe.ts", 'export * from "@repo/db/remote";'],
  ["infra/cloudflare/src/probe.ts", "export const load = (target: string) => import(target);"],
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
  ["libs/config/src/cli.ts", "export const done = () => { process.exitCode = 0; };"],
  [
    "libs/config/src/cli.ts",
    'import { NodeRuntime } from "@effect/platform-node"; export const start = () => NodeRuntime.runMain(0);',
  ],
  ["libs/ui/src/probe.ts", 'export * from "@repo/ui/button";'],
  ["libs/ui/src/probe.ts", 'export * from "styled-components-extra";'],
  ["libs/ui/src/probe.ts", 'export * from "pulumi-helpers";'],
  [
    "tools/dev/src/probe.ts",
    "export const code = (process: { readonly exitCode: number }) => process.exitCode;",
  ],
  ["libs/config/src/probe.ts", "export const value = import.meta.env;"],
  ["infra/cloudflare/src/probe.ts", "export const value = process.env;"],
  ["tools/observe/src/probe.ts", "export const value = process.env;"],
  ["libs/db/src/probe.ts", 'export * from "drizzle-orm";'],
  ["libs/auth/src/probe.test.ts", 'export * from "@repo/db/admin";'],
  ["libs/auth/src/probe-fixture.ts", 'export * from "@repo/db/testing";'],
  [
    "libs/observability/src/annotations.ts",
    'import { Effect } from "effect"; export const run = () => Effect.annotateCurrentSpan({ a: "b" });',
  ],
  [
    "libs/observability/src/annotations.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withSpan(e, "x");',
  ],
  [
    "libs/observability/src/severity.ts",
    'import { Effect } from "effect"; export const run = () => Effect.logError("boom");',
  ],
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
    expect(configuredLintRules).toMatchObject(
      Object.fromEntries(ruleNames.map((rule) => [`project/${rule}`, "error"])),
    );
  });

  it.for(forbiddenCode)("rejects forbidden code in %s", ([name, code, rule]) => {
    expect.hasAssertions();
    expect(reported(rule, { code, filename: name })).toBe(true);
  });

  it.for(singleReports)("reports a default import member call once: %s", ([rule, code]) => {
    expect.hasAssertions();
    expect(reportCount(rule, { code, filename: "libs/ui/src/probe.ts" })).toBe(1);
  });

  it.for(opaqueSpecifiers)("rejects an opaque specifier: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", { code, filename: name })).toBe(true);
  });

  it.for(validBoundaries)("allows valid boundary in %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: name })).toStrictEqual([]);
  });

  it("allows shared pure code", () => {
    expect.hasAssertions();
    expect(
      reportedRules({
        code: "export const add = (a: number, b: number) => a + b;\n",
        filename: "valid.ts",
      }),
    ).toStrictEqual([]);
  });
});
