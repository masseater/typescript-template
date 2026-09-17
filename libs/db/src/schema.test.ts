import { Effect, Schema } from "effect";
import { EmptyTestDatabase, TestBinding, runStatement } from "./testing.ts";
import { assert, it } from "@effect/vitest";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/payload/sqlite";
import { migrateD1 } from "./migrate-d1.ts";
import { schema } from "./schema.ts";

type SqliteSnapshot = Parameters<typeof generateMigration>[0];

const snapshots: Readonly<Record<string, SqliteSnapshot>> = import.meta.glob(
  "../migrations/*/snapshot.json",
  { eager: true, import: "default" },
);

const TEST_TIMEOUT_MS = 60_000;

const appliedTriggers = [
  "session_insert_current_version",
  "session_update_current_version",
  "user_delete_pending_auth",
  "user_keep_last_admin_delete",
  "user_keep_last_admin_update",
  "user_role_revoke_oauth_grants",
  "user_role_revoke_sessions",
];

const NameRows = Schema.Array(Schema.Struct({ name: Schema.String }));
const PragmaRows = Schema.Array(Schema.Record(Schema.String, Schema.Unknown));

const objectNames = Effect.fn("objectNames")(function* objectNames(type: string) {
  const result = yield* runStatement(
    "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA', '__drizzle_migrations') ORDER BY name",
    type,
  );
  const rows = yield* Schema.decodeUnknownEffect(NameRows)(result.results);
  return rows.map((row) => row.name);
});

const positionalKeys = new Set(["cid", "id", "seq"]);

function isPrimaryKeyColumn(row: Readonly<Record<string, unknown>>): boolean {
  return row["pk"] === 1;
}

function comparableColumn(row: Readonly<Record<string, unknown>>): string {
  const kept = Object.keys(row)
    .filter((key) => !positionalKeys.has(key) && !(key === "notnull" && isPrimaryKeyColumn(row)))
    .toSorted((left, right) => left.localeCompare(right));
  return JSON.stringify(kept.map((key) => [key, row[key]]));
}

const pragmaRows = Effect.fn("pragmaRows")(function* pragmaRows(pragma: string, table: string) {
  const result = yield* runStatement(`PRAGMA ${pragma}("${table}")`);
  return yield* Schema.decodeUnknownEffect(PragmaRows)(result.results);
});

const describedRows = Effect.fn("describedRows")(function* describedRows(
  pragma: string,
  table: string,
) {
  const rows = yield* pragmaRows(pragma, table);
  return rows
    .map((row) => `${pragma} ${comparableColumn(row)}`)
    .toSorted((left, right) => left.localeCompare(right));
});

const primaryKeyNullability = Effect.fn("primaryKeyNullability")(function* primaryKeyNullability(
  tables: readonly string[],
) {
  const flags = new Set<unknown>();
  for (const table of tables) {
    for (const row of yield* pragmaRows("table_info", table)) {
      if (isPrimaryKeyColumn(row)) {
        flags.add(row["notnull"]);
      }
    }
  }
  return [...flags];
});

const describeDatabase = Effect.fn("describeDatabase")(function* describeDatabase() {
  const tables = yield* objectNames("table");
  const shape: Record<string, readonly string[]> = {};
  for (const table of tables) {
    shape[table] = [
      ...(yield* describedRows("table_info", table)),
      ...(yield* describedRows("index_list", table)),
      ...(yield* describedRows("foreign_key_list", table)),
    ];
  }
  return {
    primaryKeyNotNull: yield* primaryKeyNullability(tables),
    shape,
    tables,
    triggers: yield* objectNames("trigger"),
  };
});

const generatedStatements = Effect.fn("generatedStatements")(function* generatedStatements() {
  const empty = yield* Effect.promise(async () => generateDrizzleJson({}));
  const modelled = yield* Effect.promise(async () => generateDrizzleJson(schema));
  return yield* Effect.promise(async () => generateMigration(empty, modelled));
});

it.effect(
  "the applied migrations build the database that the models describe",
  () =>
    Effect.gen(function* program() {
      const applied = yield* Effect.gen(function* fromMigrations() {
        yield* migrateD1(yield* TestBinding);
        return yield* describeDatabase();
      }).pipe(Effect.provide(EmptyTestDatabase));
      const generated = yield* Effect.gen(function* fromModels() {
        for (const statement of yield* generatedStatements()) {
          yield* runStatement(statement);
        }
        return yield* describeDatabase();
      }).pipe(Effect.provide(EmptyTestDatabase));
      assert.deepStrictEqual(generated.tables, applied.tables);
      assert.deepStrictEqual(generated.shape, applied.shape);
      assert.deepStrictEqual(generated.triggers, []);
      assert.deepStrictEqual(applied.triggers, appliedTriggers);
      assert.deepStrictEqual(applied.primaryKeyNotNull, [1]);
      assert.deepStrictEqual(generated.primaryKeyNotNull, [0]);
    }),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect("the models need no further migration", () =>
  Effect.gen(function* program() {
    const latest = Object.keys(snapshots)
      .toSorted((left, right) => left.localeCompare(right))
      .at(-1);
    const applied = latest === undefined ? undefined : snapshots[latest];
    const pending =
      applied === undefined
        ? ["no migration snapshot found"]
        : yield* Effect.promise(async () =>
            generateMigration(applied, await generateDrizzleJson(schema)),
          );
    assert.deepStrictEqual(pending, []);
  }),
);
