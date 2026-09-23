import { describe, expect, it } from "vite-plus/test";

import { reported, reportedRules } from "./lint-harness.ts";

const rawD1Operations = [
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
    'import type { DatabaseBinding as Storage } from "@repo/db"; export const load = (db: Storage) => db.exec("SELECT 1");',
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
    'import type { Database } from "@repo/db"; export const load = (db: Database) => db.$client.exec("SELECT 1");',
  ],
  [
    "orm-factory-client",
    'import { createDb } from "@repo/db"; export const load = (binding: D1Database) => createDb(binding).$client.exec("SELECT 1");',
  ],
  [
    "config-type",
    'import type { AppConfig } from "@repo/config"; export const load = (config: AppConfig) => config.DB.exec("SELECT 1");',
  ],
  [
    "config-factory",
    'import { readConfig as config } from "@repo/config"; export const load = (input: unknown) => config(input).DB.exec("SELECT 1");',
  ],
  [
    "request-context",
    'import type { AppRequestContext } from "@repo/runtime"; export const load = (context: AppRequestContext) => context.runtime.config.DB.exec("SELECT 1");',
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
] as const;

const rawD1OutsideAdapter = [
  [
    "libs/db/src/features/db/security.ts",
    'export const load = (db: D1Database) => db.exec("SELECT 1");',
  ],
  [
    "tools/dev/src/features/dev/probe.ts",
    'export const load = (db: D1Database) => db.exec("SELECT 1");',
  ],
  [
    "apps/service-member/src/probe.test.ts",
    'export const load = (db: D1Database) => db.exec("SELECT 1");',
  ],
] as const;

const rawD1Adapters = [
  ["libs/db/src/features/db/testing.ts"],
  ["libs/db-local/src/features/db-local/testing-node.ts"],
] as const;

const nonD1Operations = [
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
    'import type { Database } from "@repo/db"; export const load = (db: Database) => db.select().all();',
  ],
  [
    "binding-injection",
    'import { createDb } from "@repo/db"; export const load = (binding: D1Database) => createDb(binding);',
  ],
] as const;

describe("project lint rules on raw D1 access", () => {
  it.for(rawD1Operations)("rejects raw D1 operation: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", { code, filename: "apps/service-member/src/probe.ts" })).toBe(
      true,
    );
  });

  it.for(rawD1OutsideAdapter)("rejects raw D1 outside the adapter in %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reported("boundaries", { code, filename: name })).toBe(true);
  });

  it.for(nonD1Operations)("allows non-D1 operation: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: "libs/shared/src/shared/probe.ts" })).toStrictEqual([]);
  });

  it.for(rawD1Adapters)("allows raw D1 in the %s adapter", ([name]) => {
    expect.hasAssertions();
    expect(
      reportedRules({
        code: 'export const load = (db: D1Database) => db.exec("SELECT 1");',
        filename: name,
      }),
    ).toStrictEqual([]);
  });
});
