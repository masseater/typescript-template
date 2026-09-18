import {
  APPLICATION_TABLES,
  loadMigrations,
  migrateD1,
  migrationsFolder,
} from "./remote-operations.ts";
import { EmptyTestDatabase, TestBinding, failureCode, runStatement } from "./testing-node.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { appendFile, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { assert, it } from "@effect/vitest";
// oxlint-disable-next-line import/no-nodejs-modules
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import type { Scope } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const TEST_TIMEOUT_MS = 60_000;

function changedMigrations(
  change: (folder: string) => Promise<void>,
): Effect.Effect<string, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.promise(async () => {
      const folder = await mkdtemp(path.join(tmpdir(), "template-migrations-"));
      await cp(migrationsFolder, folder, { recursive: true });
      await change(folder);
      return folder;
    }),
    (folder) => Effect.promise(async () => rm(folder, { force: true, recursive: true })),
  );
}

it.effect(
  "applies real D1 migrations once and rolls back an interrupted migration",
  () =>
    Effect.gen(function* program() {
      const binding = yield* TestBinding;
      const migrations = yield* loadMigrations();
      assert.strictEqual(yield* migrateD1(binding), migrations.length);
      assert.strictEqual(yield* migrateD1(binding), 0);
      const interrupted = yield* changedMigrations(async (folder) => {
        await mkdir(path.join(folder, "99999999999999_interrupted"));
        await writeFile(
          path.join(folder, "99999999999999_interrupted", "migration.sql"),
          "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
        );
      });
      assert.strictEqual(
        yield* failureCode(migrateD1(binding, interrupted)),
        "REMOTE_QUERY_FAILED",
      );
      const leftover = yield* runStatement(
        "SELECT name FROM sqlite_master WHERE name = ?",
        "interrupted_migration",
      );
      assert.deepStrictEqual(leftover.results, []);
    }).pipe(Effect.scoped, Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "rejects migrations whose applied history changed",
  () =>
    Effect.gen(function* program() {
      const binding = yield* TestBinding;
      const [first] = yield* loadMigrations();
      yield* migrateD1(binding);
      const changed = yield* changedMigrations(async (folder) => {
        await appendFile(path.join(folder, first?.name ?? "", "migration.sql"), "\n");
      });
      assert.strictEqual(
        yield* failureCode(migrateD1(binding, changed)),
        "REMOTE_MIGRATION_HISTORY_MISMATCH",
      );
    }).pipe(Effect.scoped, Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect("counts as application tables everything but the Cloudflare and migration tables", () =>
  Effect.sync(() => {
    const storage = new DatabaseSync(":memory:");
    for (const name of [
      "__drizzle_migrations",
      "_cf_KV",
      "_cf_METADATA",
      "acfxtable",
      "cf_users",
      "d1_migrations",
      "sqlitex_thing",
      "user",
    ]) {
      storage.exec(`CREATE TABLE "${name}" (id TEXT)`);
    }
    const names = storage.prepare(APPLICATION_TABLES).all();
    storage.close();
    assert.deepStrictEqual(names, [
      { name: "acfxtable" },
      { name: "cf_users" },
      { name: "sqlitex_thing" },
      { name: "user" },
    ]);
  }),
);

it.effect(
  "refuses to migrate application tables that have no recorded history",
  () =>
    Effect.gen(function* program() {
      yield* runStatement("CREATE TABLE user (id TEXT PRIMARY KEY)");
      assert.strictEqual(
        yield* failureCode(migrateD1(yield* TestBinding)),
        "REMOTE_MIGRATION_HISTORY_MISSING",
      );
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);
