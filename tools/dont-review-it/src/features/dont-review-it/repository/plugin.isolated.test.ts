import { describe, expect, it } from "vite-plus/test";

import { reportCount, reported, reportedRules, ruleNames } from "./lint-harness.ts";
import { configuredLintRules, lintOptions } from "./lint.ts";

const forbiddenCode = [
  [
    "apps/service-member/src/probe.ts",
    "export const load = (target: string) => import(target);",
    "boundaries",
  ],
  [
    "apps/service-member/probe.ts",
    'import { vi } from "vitest"; vi.mock("owned-module");',
    "no-internal-mocks",
  ],
  ["apps/service-member/probe.ts", 'console.log(process.env["SECRET"]);', "environment-boundary"],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { useCallback } from "react"; export const fn = () => useCallback(() => 0, []);',
    "no-manual-memoization",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import React from "react"; export const Panel = React.memo(() => null);',
    "no-manual-memoization",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import * as React from "react"; export const Panel = React.memo(() => null);',
    "no-manual-memoization",
  ],
  [
    "apps/service-member/src/probe.ts",
    'import { useMemo as cache } from "react"; export const fn = () => cache(() => 0, []);',
    "no-manual-memoization",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { forwardRef } from "react"; export const Input = forwardRef((props: object) => props);',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import React from "react"; export const Input = React.forwardRef((props: object) => props);',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { forwardRef as wrap } from "react"; export const Input = wrap;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { createFactory } from "react"; export const div = createFactory("div");',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { createContext } from "react"; const Theme = createContext("light"); export const Panel = () => <Theme.Provider value="dark" />;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { createContext } from "react"; const Theme = createContext("light"); const Alias = Theme; export const Panel = () => <Alias.Provider value="dark" />;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'export const Panel = () => <input ref="name" />;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'export const Panel = () => <input ref={"name"} />;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'const Button = (label = "ok") => label; Button.defaultProps = { label: "ok" }; export { Button };',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    "const Button = () => null; Button.propTypes = {}; export { Button };",
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { findDOMNode } from "react-dom"; export const nodeOf = findDOMNode;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { render } from "react-dom"; export const mount = render;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { hydrate } from "react-dom"; export const mount = hydrate;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { unmountComponentAtNode } from "react-dom"; export const unmount = unmountComponentAtNode;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { renderToNodeStream } from "react-dom/server"; export const stream = renderToNodeStream;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { renderToStaticNodeStream } from "react-dom/server"; export const stream = renderToStaticNodeStream;',
    "react-legacy",
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { create } from "react-test-renderer"; export const tree = create;',
    "react-legacy",
  ],
  ["libs/ui/src/features/ui/probe.ts", 'export { forwardRef } from "react";', "react-legacy"],
  ["libs/ui/src/features/ui/probe.ts", 'export * from "react-test-renderer";', "react-legacy"],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { useEffect, useEffectEvent } from "react"; export const Chat = (roomId: string) => { const onConnected = useEffectEvent(() => roomId); useEffect(() => { onConnected(); }, [roomId, onConnected]); };',
    "effect-event-deps",
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { useEffectEvent as event, useLayoutEffect } from "react"; export const Chat = (roomId: string) => { const onConnected = event(() => roomId); useLayoutEffect(() => { onConnected(); }, [onConnected]); };',
    "effect-event-deps",
  ],
  ["libs/ui/src/features/ui/probe.ts", 'export * from "styled-components";', "retired-imports"],
  [
    "apps/service-member/src/probe.ts",
    'export { ThemeProvider } from "styled-components/native";',
    "retired-imports",
  ],
  [
    "infra/cloudflare/src/features/cloudflare/probe.ts",
    'export * from "@pulumi/aws";',
    "retired-imports",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    'import legacy = require("styled-components"); export { legacy };',
    "retired-imports",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    'export const load = () => import("pulumi");',
    "retired-imports",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    "export const done = () => { process.exitCode = 0; };",
    "process-boundary",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    "export const code = () => globalThis.process.stdout;",
    "process-boundary",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    "export const write = (line: string) => process.stderr.write(line);",
    "process-boundary",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    "const { exitCode } = process; export const code = () => exitCode;",
    "process-boundary",
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    'import { stdout } from "node:process"; export const write = () => stdout.write("x");',
    "process-boundary",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { NodeRuntime as runtime } from "@effect/platform-node"; export const start = () => runtime.runMain(0);',
    "process-boundary",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { runMain } from "@effect/platform-node/NodeRuntime"; export const start = () => runMain(0);',
    "process-boundary",
  ],
  [
    "libs/observability/src/features/observability/server.ts",
    'export const send = () => fetch("http://collector", { redirect: "error" });',
    "worker-fetch",
  ],
  [
    "infra/budget-monitor/src/features/budget-monitor/billing.ts",
    'const mode = "error"; export const send = () => fetch("https://api", { redirect: mode });',
    "worker-fetch",
  ],
  [
    "infra/error-monitor/src/features/error-monitor/telemetry.ts",
    'export const send = () => fetch("https://api", { redirect: "error" });',
    "worker-fetch",
  ],
  [
    "libs/shared/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { if (Effect) throw new Error("x"); };',
    "effect-failures",
  ],
  [
    "infra/budget-monitor/src/features/budget-monitor/probe.ts",
    'import { Effect } from "effect"; export const run = () => { try { return Effect; } catch { return undefined; } };',
    "effect-failures",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { Effect } from "effect"; export const run = Effect.void.pipe(Effect.annotateLogs({ a: "b" }));',
    "annotations",
  ],
  [
    "apps/service-member/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => Effect.annotateCurrentSpan({ a: "b" });',
    "annotations",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { annotateSpans } from "effect/Effect"; export const run = () => annotateSpans;',
    "annotations",
  ],
  [
    "tools/dev/src/features/dev/observe/probe.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withLogSpan(e, "x");',
    "annotations",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withSpan(e, "x");',
    "annotations",
  ],
  [
    "apps/service-member/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => Effect.logError("boom");',
    "logs",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { logWarning } from "effect/Effect"; export const run = () => logWarning;',
    "logs",
  ],
  [
    "apps/service-member/src/probe.ts",
    'export const mark = (span: { attribute: (key: string, value: string) => void }) => span.attribute("a", "b");',
    "span-mutation",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'export const mark = (span: { event: (name: string) => void }) => span.event("x");',
    "span-mutation",
  ],
  [
    "apps/service-member/src/probe.ts",
    'import { ManagedRuntime } from "effect"; export const run = () => ManagedRuntime;',
    "cross-request-state",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { Effect } from "effect"; export const cache = () => Effect.cachedWithTTL(Effect.void, "1 minute");',
    "cross-request-state",
  ],
  [
    "libs/runtime/src/features/runtime/probe.ts",
    'import { cachedWithTTL } from "effect/Effect"; export const cache = () => cachedWithTTL;',
    "cross-request-state",
  ],
  [
    "apps/service-admin/src/probe.ts",
    'import { RcMap } from "effect"; export const shared = () => RcMap;',
    "cross-request-state",
  ],
] as const;

const opaqueSpecifiers = [
  [
    "concatenated",
    "apps/service-member/src/probe.ts",
    'const target = "@repo/db/" + "admin"; export const load = () => import(target);',
  ],
  [
    "template",
    "apps/service-member/src/probe.ts",
    "export const load = () => import(`@repo/db/admin`);",
  ],
  [
    "variable",
    "apps/service-member/src/probe.ts",
    'const target = "@repo/db/admin"; export const load = () => import(target);',
  ],
  [
    "unknown",
    "apps/service-member/src/probe.ts",
    "export const load = (target: string) => import(target);",
  ],
  [
    "require",
    "libs/auth/src/features/auth/probe.ts",
    'export const admin = require("@repo/db/admin");',
  ],
  [
    "require-alias",
    "libs/auth/src/features/auth/probe.ts",
    'const load = require; export const admin = load("@repo/db/admin");',
  ],
  [
    "create-require",
    "libs/auth/src/features/auth/probe.ts",
    'import { createRequire as factory } from "node:module"; export const load = factory(import.meta.url);',
  ],
  [
    "import-equals",
    "apps/service-member/src/probe.ts",
    'import admin = require("@repo/db/admin"); export { admin };',
  ],
] as const;

const validBoundaries = [
  ["apps/service-admin/src/app/probe.ts", 'export * from "@repo/db/admin";'],
  ["apps/service-member/src/app/probe.ts", 'export * from "@repo/db/admin";'],
  ["apps/service-member/src/app/probe.ts", 'import "@repo/db/src/schema";'],
  [
    "libs/ui/src/features/ui/probe.ts",
    'export const send = () => fetch("/api", { redirect: "error" });',
  ],
  ["tools/dev/src/features/dev/probe.ts", 'export * from "@repo/db/remote";'],
  ["infra/cloudflare/src/features/cloudflare/probe.ts", 'export * from "@repo/db/remote";'],
  [
    "infra/cloudflare/src/features/cloudflare/probe.ts",
    "export const load = (target: string) => import(target);",
  ],
  ["libs/db/src/features/db/remote.ts", 'export * from "./remote-operations";'],
  ["apps/service-member/src/app/probe.ts", 'export * from "@repo/db";'],
  ["apps/internal-dashboard/vite.config.ts", 'export { localDatabase } from "@repo/db/local";'],
  ["apps/internal-dashboard/src/app/probe.ts", 'export * from "@repo/auth";'],
  ["apps/service-member/src/app/probe.ts", 'export const load = () => import("./feature");'],
  [
    "libs/shared/src/shared/probe.ts",
    "export const fn = (process: { env: string }) => process.env;",
  ],
  [
    "libs/shared/src/shared/probe.ts",
    "export const fn = (vi: { mock: () => number }) => vi.mock();",
  ],
  ["libs/shared/src/shared/probe.ts", "export const location = import.meta.url;"],
  ["libs/shared/src/shared/probe.ts", 'export { http } from "msw";'],
  ["libs/config/src/features/config/probe.ts", "export const value = process.env;"],
  ["libs/cli/src/features/cli/cli.ts", "export const done = () => { process.exitCode = 0; };"],
  [
    "libs/cli/src/features/cli/cli.ts",
    'import { NodeRuntime } from "@effect/platform-node"; export const start = () => NodeRuntime.runMain(0);',
  ],
  [
    "libs/cli/src/features/cli/cli.ts",
    "export const write = (line: string) => process.stdout.write(line);",
  ],
  [
    "libs/cli/src/features/cli/cli.ts",
    "export const warn = (line: string) => process.stderr.write(line);",
  ],
  ["libs/ui/src/features/ui/probe.ts", 'export * from "@repo/ui/button";'],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { createContext, use } from "react"; const Theme = createContext("light"); export const Panel = ({ inputRef }: { readonly inputRef?: never }) => <Theme value="dark"><input ref={inputRef} /></Theme>; export const useTheme = () => use(Theme);',
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { Menu } from "base-ui"; export const Panel = () => <Menu.Provider />;',
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { createRoot, hydrateRoot } from "react-dom/client"; export const mount = { createRoot, hydrateRoot };',
  ],
  [
    "libs/ui/src/features/ui/probe.ts",
    'import { renderToString } from "react-dom/server"; export const html = renderToString;',
  ],
  [
    "libs/ui/src/features/ui/probe.tsx",
    'import { useEffect, useEffectEvent } from "react"; export const Chat = (roomId: string) => { const onConnected = useEffectEvent(() => roomId); useEffect(() => { onConnected(); }, [roomId]); };',
  ],
  ["libs/ui/src/features/ui/probe.ts", 'export * from "styled-components-extra";'],
  ["libs/ui/src/features/ui/probe.ts", 'export * from "pulumi-helpers";'],
  [
    "tools/dev/src/features/dev/probe.ts",
    "export const code = (process: { readonly exitCode: number }) => process.exitCode;",
  ],
  ["libs/config/src/features/config/probe.ts", "export const value = import.meta.env;"],
  ["infra/cloudflare/src/features/cloudflare/probe.ts", "export const value = process.env;"],
  ["tools/dev/src/features/dev/observe/probe.ts", "export const value = process.env;"],
  ["libs/db/src/features/db/probe.ts", 'export * from "drizzle-orm";'],
  ["libs/auth/src/features/auth/probe.test.ts", 'export * from "@repo/db/admin";'],
  ["libs/auth/src/features/auth/probe-fixture.ts", 'export * from "@repo/db/testing";'],
  [
    "libs/observability/src/features/observability/annotations.ts",
    'import { Effect } from "effect"; export const run = () => Effect.annotateCurrentSpan({ a: "b" });',
  ],
  [
    "libs/observability/src/features/observability/annotations.ts",
    'import { Effect } from "effect"; export const run = (e: never) => Effect.withSpan(e, "x");',
  ],
  [
    "libs/observability/src/features/observability/severity.ts",
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
  it("every project rule is enabled", () => {
    expect.hasAssertions();
    expect(configuredLintRules).toMatchObject(
      Object.fromEntries(ruleNames.map((rule) => [`project/${rule}`, "error"])),
    );
  });

  it("turns atom-server-data off for auth-ui after the workspace error", () => {
    expect.hasAssertions();
    const severityAt = (severity: string): number =>
      lintOptions.overrides.findIndex(
        (override) => override.rules?.["project/atom-server-data"] === severity,
      );
    expect(severityAt("off")).toBeGreaterThan(severityAt("error"));
  });

  it.for(forbiddenCode)("rejects forbidden code in %s", ([name, code, rule]) => {
    expect.hasAssertions();
    expect(reported(rule, { code, filename: name })).toBe(true);
  });

  it.for(singleReports)("reports a default import member call once: %s", ([rule, code]) => {
    expect.hasAssertions();
    expect(reportCount(rule, { code, filename: "libs/ui/src/features/ui/probe.ts" })).toBe(1);
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
