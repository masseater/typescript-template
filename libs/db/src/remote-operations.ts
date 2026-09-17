import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { Effect, Schema } from "effect";
import { bootstrapStatement } from "./bootstrap-statement.ts";
import type { EmailAddress } from "./bootstrap-statement.ts";
import { RemoteFailure, fail } from "./remote-input.ts";

export interface DatabaseExecutor {
  batch(
    queries: readonly { sql: string; params: readonly (string | number | null)[] }[],
  ): Effect.Effect<readonly (readonly unknown[])[], RemoteFailure>;
}

const Migration = Schema.Struct({
  sql: Schema.Array(Schema.Trim.check(Schema.isMinLength(1))).check(Schema.isMinLength(1)),
  folderMillis: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});
type Migration = typeof Migration.Type;

const StatementParams = Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Null]));

const History = Schema.Array(Schema.Struct({ hash: Schema.String, created_at: Schema.Finite }));

const BootstrappedAdmin = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: Schema.Literal("admin"),
});

export const loadRemoteMigrations = Effect.fn("loadRemoteMigrations")(function* () {
  const migrations = yield* Effect.try({
    try: () =>
      readMigrationFiles({
        migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)),
      }),
    catch: () => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" }),
  }).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.Array(Migration).check(Schema.isMinLength(1))),
    ),
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" })),
  );
  if (
    migrations.some(
      (item, index) => index > 0 && item.folderMillis <= (migrations[index - 1]?.folderMillis ?? 0),
    )
  )
    return yield* fail("REMOTE_MIGRATIONS_INVALID");
  return migrations;
});

const readHistory = Effect.fn("readHistory")(function* (
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  const [rows] = yield* executor.batch([
    { sql: "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at", params: [] },
  ]);
  const history = yield* Schema.decodeUnknownEffect(History)(rows).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" })),
  );
  if (
    history.some(
      (item, index) =>
        item.hash !== migrations[index]?.hash ||
        item.created_at !== migrations[index]?.folderMillis,
    )
  )
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  return history.length;
});

export const migrateDatabase = Effect.fn("migrateDatabase")(function* (
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  yield* executor.batch([
    {
      sql: "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, created_at NUMERIC NOT NULL UNIQUE)",
      params: [],
    },
  ]);
  const applied = yield* readHistory(executor, migrations);
  for (const migration of migrations.slice(applied))
    yield* executor.batch([
      ...migration.sql.map((sql) => ({ sql, params: [] })),
      {
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        params: [migration.hash, migration.folderMillis],
      },
    ]);
  if ((yield* readHistory(executor, migrations)) !== migrations.length)
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  return migrations.length - applied;
});

export const bootstrapDatabase = Effect.fn("bootstrapDatabase")(function* (
  executor: DatabaseExecutor,
  email: typeof EmailAddress.Type,
) {
  const migrations = yield* loadRemoteMigrations();
  if ((yield* readHistory(executor, migrations)) !== migrations.length)
    return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
  const compiled = new SQLiteAsyncDialect().sqlToQuery(bootstrapStatement(email));
  const params = yield* Schema.decodeUnknownEffect(StatementParams)(compiled.params).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" })),
  );
  const [rows] = yield* executor.batch([{ sql: compiled.sql, params }]);
  if (rows?.length !== 1) return yield* fail("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(rows?.[0]).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );
});
