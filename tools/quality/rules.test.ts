import { RuleTester } from "vite-plus/lint/plugins-dev";
import { expect, test } from "vite-plus/test";
import manifest from "../../package.json" with { type: "json" };
import config from "../../vite.config.ts";
import plugin from "./rules.ts";

RuleTester.describe = (_text, run) => run();
RuleTester.it = (_text, run) => run();
const tester = new RuleTester({ cwd: "/project" });
type RuleName =
  | "boundaries"
  | "no-internal-mocks"
  | "environment-boundary"
  | "worker-fetch"
  | "test-import-graph";
const ruleNames: RuleName[] = [
  "boundaries",
  "no-internal-mocks",
  "environment-boundary",
  "worker-fetch",
  "test-import-graph",
];
const reported = (name: RuleName, filename: string, code: string) => {
  const rule = plugin.rules[name];
  if (!rule) throw new Error(`Unknown rule ${name}`);
  try {
    tester.run(name, rule, { valid: [{ filename, code }], invalid: [] });
    return false;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Should have no errors but had"))
      return true;
    throw error;
  }
};
const reportedRules = (filename: string, code: string) =>
  ruleNames.filter((rule) => reported(rule, filename, code));

test("every project rule is tested and enabled", () => {
  expect(Object.keys(plugin.rules).sort()).toEqual([...ruleNames].sort());
  expect(config.lint?.rules).toMatchObject(
    Object.fromEntries(ruleNames.map((rule) => [`project/${rule}`, "error"])),
  );
});

test.for([
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
] as const)("rejects forbidden code in %s", ([name, code, rule]) => {
  expect(reported(rule, name, code)).toBe(true);
});

test.for([
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
] as const)("rejects dependency bypass: %s", ([_label, name, code]) => {
  expect(reported("boundaries", name, code)).toBe(true);
});

test.for([
  ["import-alias", 'import { vi as tools } from "vitest"; tools.mock("owned");'],
  ["rest-alias", 'import { vi } from "vitest"; const { ...tools } = vi; tools.mock("owned");'],
  [
    "destructure-assignment",
    'import { vi } from "vitest"; let replace; ({ mock: replace } = vi); replace("owned");',
  ],
  ["namespace", 'import * as tools from "vitest"; tools.vi.fn();'],
  [
    "namespace-destructure",
    'import * as tools from "vitest"; const { vi: kit } = tools; kit.spyOn({}, "method");',
  ],
  [
    "nested-destructure",
    'import * as tools from "vitest"; const { vi: { mock: replace } } = tools; replace("owned");',
  ],
  [
    "method-destructure",
    'import { vi } from "vitest"; const { mock: replace } = vi; replace("owned");',
  ],
  [
    "alias-chain",
    'import { vi as first } from "vitest"; const second = first; const third = second; third.doMock("owned");',
  ],
  [
    "computed-method",
    'import { vi as tools } from "vitest"; const key = "stub" + "Global"; tools[key]("fetch", () => null);',
  ],
  ["optional-method", 'import { vi as tools } from "vitest"; tools?.fn();'],
  ["require-destructure", 'const { vi: tools } = require("vitest"); tools.fn();'],
  ["dynamic-destructure", 'const { vi: tools } = await import("vitest"); tools.fn();'],
  ["reassignment", 'import { vi } from "vitest"; let tools; tools = vi; tools.fn();'],
  ["jest-alias", 'import { jest as tools } from "@jest/globals"; tools.spyOn({}, "method");'],
  ["direct-spy-import", 'import { fn as replace } from "@vitest/spy"; replace();'],
  ["vite-plus-import", 'import { vi as tools } from "vite-plus/test"; tools.mock("owned");'],
  [
    "vite-plus-namespace",
    'import * as tools from "vite-plus/test"; const { vi: kit } = tools; kit.fn();',
  ],
  ["vite-plus-dynamic", 'const { vi: tools } = await import("vite-plus/test"); tools.fn();'],
  [
    "vite-plus-spy-import",
    'import { fn as replace } from "vite-plus/test/plugins/spy"; replace();',
  ],
  ["node-test-mock", 'import { mock as tools } from "node:test"; tools.fn();'],
] as const)("rejects mock bypass: %s", ([_label, code]) => {
  expect(reported("no-internal-mocks", "probe.ts", code)).toBe(true);
});

test.for([
  ["process-computed", 'export const value = process["env"]["SECRET"];'],
  ["process-alias", "const runtime = process; export const value = runtime.env;"],
  ["rest-process", "const { ...runtime } = process; export const value = runtime.env;"],
  ["destructure-assignment", "let values; ({ env: values } = process); export { values };"],
  ["meta-assignment", "let values; ({ env: values } = import.meta); export { values };"],
  ["process-destructure", "export const { env: values } = process;"],
  ["nested-destructure", "export const { env: { SECRET: value } } = process;"],
  ["process-import", 'import runtime from "node:process"; export const value = runtime.env;'],
  ["named-import", 'import { env as values } from "node:process"; export { values };'],
  ["process-reexport", 'export { env as values } from "node:process";'],
  ["process-require", 'const { env: values } = require("process"); export { values };'],
  ["global-process", "export const value = globalThis.process.env;"],
  [
    "global-destructure",
    "const { process: runtime } = globalThis; export const value = runtime.env;",
  ],
  ["meta-env", "export const value = import.meta.env;"],
  ["meta-computed", 'export const value = import.meta["env"]["PUBLIC_SECRET"];'],
  ["meta-alias", "const meta = import.meta; export const value = meta.env;"],
  ["meta-destructure", "export const { env: values } = import.meta;"],
  ["meta-nested", "export const { env: { SECRET: value } } = import.meta;"],
] as const)("rejects environment bypass: %s", ([_label, code]) => {
  expect(reported("environment-boundary", "libs/shared/src/probe.ts", code)).toBe(true);
});

test.for([
  ["apps/admin/src/probe.ts", 'export * from "@template/db/admin";'],
  ["libs/ui/src/probe.ts", 'export const send = () => fetch("/api", { redirect: "error" });'],
  ["tools/dev/src/probe.ts", 'export * from "@template/db/remote";'],
  ["infra/cloudflare/src/probe.ts", 'export * from "@template/db/remote";'],
  ["libs/db/src/remote.ts", 'export * from "./remote-operations";'],
  ["apps/user/src/probe.ts", 'export * from "@template/db";'],
  ["apps/user/src/probe.ts", 'export * from "@template/ui/signup";'],
  ["apps/wiki/vite.config.ts", 'export { localDatabase } from "@template/db/local";'],
  ["apps/wiki/src/probe.ts", 'export * from "@template/auth";'],
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
] as const)("allows valid boundary in %s", ([name, code]) => {
  expect(reportedRules(name, code)).toEqual([]);
});

test("allows shared pure code", () => {
  expect(
    reportedRules("valid.ts", "export const add = (a: number, b: number) => a + b;\n"),
  ).toEqual([]);
});

test.for([
  ["global-type", 'export const load = (db: D1Database) => db.prepare("SELECT 1");'],
  [
    "parameter-method-destructure",
    "export function load({ exec: run }: D1Database) { return run; }",
  ],
  [
    "computed-const",
    'export function load(db: D1Database) { const key = "exec" as const; return db[key]("SELECT 1"); }',
  ],
  [
    "computed-dynamic",
    'export const load = (db: D1Database, key: "exec" | "prepare") => db[key]("SELECT 1");',
  ],
  [
    "worker-binding-destructure",
    'import { env } from "cloudflare:workers"; const { DB: storage } = env; export const load = () => storage.exec("SELECT 1");',
  ],
  [
    "worker-namespace",
    'import * as worker from "cloudflare:workers"; export const load = () => worker.env.DB.exec("SELECT 1");',
  ],
  [
    "import-alias",
    'import type { D1Database as Storage } from "@cloudflare/workers-types"; export const load = (db: Storage) => db.exec("SELECT 1");',
  ],
  [
    "namespace-type",
    'import type * as CF from "@cloudflare/workers-types"; export const load = (db: CF.D1Database) => db.batch([]);',
  ],
  [
    "local-type-alias",
    "type Storage = D1Database; type Alias = Storage; export const load = (db: Alias) => db.dump();",
  ],
  [
    "inline-import-type",
    'export const load = (db: import("@cloudflare/workers-types").D1Database) => db.exec("SELECT 1");',
  ],
  [
    "binding-type",
    'import type { DatabaseBinding as Storage } from "@template/db"; export const load = (db: Storage) => db.exec("SELECT 1");',
  ],
  [
    "value-alias",
    'export function load(db: D1Database) { const other = db; return other.prepare("SELECT 1"); }',
  ],
  [
    "method-alias",
    'export function load(db: D1Database) { const run = db.exec; return run("SELECT 1"); }',
  ],
  [
    "method-destructure",
    'export function load(db: D1Database) { const { exec: run } = db; return run("SELECT 1"); }',
  ],
  [
    "assignment-destructure",
    'export function load(db: D1Database) { let run; ({ exec: run } = db); return run("SELECT 1"); }',
  ],
  [
    "parameter-destructure",
    'export function load({ DB: storage }: { DB: D1Database }) { return storage.exec("SELECT 1"); }',
  ],
  [
    "nested-destructure",
    'export function load(env: { DB: D1Database }) { const { DB: { exec: run } } = env; return run("SELECT 1"); }',
  ],
  [
    "nested-type",
    "type Env = { storage: D1Database }; export const load = (env: Env) => env.storage.batch([]);",
  ],
  [
    "interface-type",
    'interface Env { DB: D1Database } export const load = (env: Env) => env.DB.exec("SELECT 1");',
  ],
  [
    "interface-extends",
    'interface Base { DB: D1Database } interface Env extends Base {} export const load = (env: Env) => env.DB.exec("SELECT 1");',
  ],
  [
    "indexed-type",
    'type Env = { DB: D1Database }; export const load = (db: Env["DB"]) => db.exec("SELECT 1");',
  ],
  ["union-type", 'export const load = (db: D1Database | undefined) => db?.prepare("SELECT 1");'],
  [
    "type-assertion",
    'export const load = (input: unknown) => (input as D1Database).exec("SELECT 1");',
  ],
  [
    "computed-method",
    'export function load(db: D1Database) { const method = "pre" + "pare"; return db[method]("SELECT 1"); }',
  ],
  ["bound-method", 'export const load = (db: D1Database) => db.exec.bind(db)("SELECT 1");'],
  ["session-type", 'export const load = (db: D1DatabaseSession) => db.prepare("SELECT 1");'],
  ["prepared-statement", "export const load = (query: D1PreparedStatement) => query.all();"],
  [
    "session-chain",
    'export const load = (db: D1Database) => db.withSession().prepare("SELECT 1").all();',
  ],
  [
    "orm-client",
    'import type { Database } from "@template/db"; export const load = (db: Database) => db.$client.exec("SELECT 1");',
  ],
  [
    "orm-factory-client",
    'import { createDb } from "@template/db"; export const load = (binding: D1Database) => createDb(binding).$client.exec("SELECT 1");',
  ],
  [
    "config-type",
    'import type { AppConfig } from "@template/config"; export const load = (config: AppConfig) => config.DB.exec("SELECT 1");',
  ],
  [
    "config-factory",
    'import { readConfig as config } from "@template/config"; export const load = (input: unknown) => config(input).DB.exec("SELECT 1");',
  ],
  [
    "request-context",
    'import type { AppRequestContext } from "@template/runtime"; export const load = (context: AppRequestContext) => context.runtime.config.DB.exec("SELECT 1");',
  ],
  [
    "worker-binding",
    'import { env as bindings } from "cloudflare:workers"; export const load = () => bindings.DB.exec("SELECT 1");',
  ],
  [
    "rest-alias",
    'export function load(db: D1Database) { const { ...other } = db; return other.exec("SELECT 1"); }',
  ],
  [
    "reassignment",
    'export function load(db: D1Database) { let other; other = db; return other.exec("SELECT 1"); }',
  ],
  [
    "object-wrapper",
    'export function load(db: D1Database) { const holder = { storage: db }; return holder.storage.exec("SELECT 1"); }',
  ],
] as const)("rejects raw D1 operation: %s", ([_label, code]) => {
  expect(reported("boundaries", "apps/user/src/probe.ts", code)).toBe(true);
});

test.for([
  ["libs/db/src/security.ts", 'export const load = (db: D1Database) => db.exec("SELECT 1");'],
  ["tools/dev/src/probe.ts", 'export const load = (db: D1Database) => db.exec("SELECT 1");'],
  ["apps/user/src/probe.test.ts", 'export const load = (db: D1Database) => db.exec("SELECT 1");'],
] as const)("rejects raw D1 outside the adapter in %s", ([name, code]) => {
  expect(reported("boundaries", name, code)).toBe(true);
});

test.for([
  ["regexp", "export const load = (input: string) => /pattern/.exec(input);"],
  [
    "regexp-alias",
    'export function load(input: string) { const expression = new RegExp("pattern"); return expression.exec(input); }',
  ],
  [
    "child-process",
    'import { exec as run } from "node:child_process"; export const load = () => run("node --version");',
  ],
  [
    "child-process-namespace",
    'import * as child from "node:child_process"; export const load = () => child.exec("node --version");',
  ],
  [
    "child-process-destructure",
    'import * as child from "node:child_process"; const { exec: run } = child; export const load = () => run("node --version");',
  ],
  [
    "unrelated-type",
    'type D1Database = { exec: (input: string) => string }; export const load = (db: D1Database) => db.exec("input");',
  ],
  [
    "unrelated-import",
    'import type { D1Database } from "other-library"; export const load = (db: D1Database) => db.exec("input");',
  ],
  ["structural-exec", "export const load = (worker: { exec: () => string }) => worker.exec();"],
  ["regexp-DB", 'export const load = (env: { DB: RegExp }) => env.DB.exec("input");'],
  [
    "orm-query",
    'import type { Database } from "@template/db"; export const load = (db: Database) => db.select().all();',
  ],
  [
    "binding-injection",
    'import { createDb } from "@template/db"; export const load = (binding: D1Database) => createDb(binding);',
  ],
] as const)("allows non-D1 operation: %s", ([_label, code]) => {
  expect(reportedRules("libs/shared/src/probe.ts", code)).toEqual([]);
});

test.for(["instrumentation", "testing"])("allows raw D1 in the %s adapter", (adapter) => {
  expect(
    reportedRules(
      `libs/db/src/${adapter}.ts`,
      'export const load = (db: D1Database) => db.exec("SELECT 1");',
    ),
  ).toEqual([]);
});

test.for([
  ["child-process", 'import { spawn } from "node:child_process"; spawn("node");'],
  ["child-process-bare", 'import * as child from "child_process"; child.execFileSync("node");'],
  ["child-process-dynamic", 'const { spawn } = await import("node:child_process");'],
  ["child-process-require", 'const child = require("node:child_process");'],
  ["child-process-builtin", 'const child = process.getBuiltinModule("node:child_process");'],
  ["child-process-reexport", 'export { spawn } from "node:child_process";'],
  ["worker-thread", 'import { Worker } from "node:worker_threads"; new Worker("./probe.ts");'],
  ["meta-url", 'const file = new URL("../fixture.json", import.meta.url);'],
  ["meta-dirname", "const directory = import.meta.dirname;"],
  ["meta-filename", "const file = import.meta.filename;"],
  ["meta-resolve", 'const entry = import.meta.resolve("./probe.ts");'],
  ["meta-computed", 'const file = import.meta["url"];'],
  ["meta-alias", "const meta = import.meta; const file = meta.url;"],
  ["meta-destructure", "const { url } = import.meta;"],
  ["meta-assignment", "let file; ({ url: file } = import.meta);"],
  ["raw-import", 'import text from "./fixture.yaml?raw";'],
  ["raw-dynamic", 'const text = await import("./fixture.yaml?raw");'],
  ["glob-query", 'import.meta.glob("./*.yaml", { eager: true, query: "?raw" });'],
  ["glob-computed-query", 'import.meta.glob("./*.yaml", { ["query"]: "?raw" });'],
  [
    "glob-spread-options",
    'const options = { query: "?raw" }; import.meta.glob("./*.yaml", { ...options });',
  ],
  [
    "glob-dynamic-options",
    'const options = { query: "?raw" }; import.meta.glob("./*.yaml", options);',
  ],
  ["glob-pattern-query", 'import.meta.glob(["./*.yaml?raw"]);'],
  ["process-cwd", "const root = process.cwd();"],
  ["process-import-cwd", 'import { cwd } from "node:process"; const root = cwd();'],
  ["process-alias-cwd", "const runtime = process; const root = runtime.cwd();"],
] as const)("rejects out-of-graph test dependency: %s", ([_label, code]) => {
  expect(reported("test-import-graph", "libs/shared/src/probe.test.ts", code)).toBe(true);
});

test.for([
  ["glob", 'const files = import.meta.glob("./fixtures/*.json", { eager: true });'],
  ["json-import", 'import manifest from "../package.json" with { type: "json" };'],
  [
    "temporary-files",
    'import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; await mkdtemp(tmpdir());',
  ],
] as const)("allows import-graph test dependency: %s", ([_label, code]) => {
  expect(reportedRules("libs/shared/src/probe.test.ts", code)).toEqual([]);
});

test("allows out-of-graph dependencies outside tests", () => {
  expect(
    reportedRules(
      "tools/dev/src/cli.ts",
      'import { spawn } from "node:child_process"; spawn(new URL(".", import.meta.url));',
    ),
  ).toEqual([]);
});

test("git hooks run the verified package scripts", () => {
  expect(import.meta.glob("../../.vite-hooks/pre-*", { eager: true, import: "default" })).toEqual({
    "../../.vite-hooks/pre-commit": "vp run precommit\n",
    "../../.vite-hooks/pre-push": "vp run prepush\n",
  });
  expect(manifest.scripts.precommit).toBe("vp run check");
  expect(manifest.scripts.check).toContain("vp check");
  expect(manifest.scripts.prepush).toContain("vp test run --changed origin/main");
});
