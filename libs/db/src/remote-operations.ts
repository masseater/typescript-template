import { Effect, Schema } from "effect";
import { RemoteFailure, fail } from "./remote-input.ts";
import type { EmailAddress } from "./bootstrap-statement.ts";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { bootstrapStatement } from "./bootstrap-statement.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";

interface RemoteQuery {
  readonly params: readonly (string | number | null)[];
  readonly sql: string;
}

interface DatabaseExecutor {
  readonly batch: (
    queries: readonly RemoteQuery[],
  ) => Effect.Effect<readonly (readonly unknown[])[], RemoteFailure>;
}

const Statement = Schema.Trim.check(Schema.isMinLength(1));
const MigrationFile = Schema.Struct({
  folderMillis: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
  sql: Schema.Array(Statement).check(Schema.isMinLength(1)),
});
const MigrationFiles = Schema.Array(MigrationFile).check(Schema.isMinLength(1));
type Migration = typeof MigrationFile.Type;

const StatementParams = Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Null]));

const History = Schema.Array(Schema.Struct({ created_at: Schema.Finite, hash: Schema.String }));

const BootstrappedAdmin = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  role: Schema.Literal("admin"),
});

const loadRemoteMigrations = Effect.fn("loadRemoteMigrations")(function* loadRemoteMigrations() {
  const migrations = yield* Effect.try({
    catch: () => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" }),
    try: () =>
      readMigrationFiles({
        migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)),
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(MigrationFiles)),
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" })),
  );
  if (
    migrations.some(
      (item, index) => index > 0 && item.folderMillis <= (migrations[index - 1]?.folderMillis ?? 0),
    )
  ) {
    return yield* fail("REMOTE_MIGRATIONS_INVALID");
  }
  return migrations;
});

const readHistory = Effect.fn("readHistory")(function* readHistory(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  const [rows] = yield* executor.batch([
    { params: [], sql: "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at" },
  ]);
  const history = yield* Schema.decodeUnknownEffect(History)(rows).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" })),
  );
  if (
    history.some(
      (item, index) =>
        item.hash !== migrations.at(index)?.hash ||
        item.created_at !== migrations.at(index)?.folderMillis,
    )
  ) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return history.length;
});

const migrateDatabase = Effect.fn("migrateDatabase")(function* migrateDatabase(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  yield* executor.batch([
    {
      params: [],
      sql: "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, created_at NUMERIC NOT NULL UNIQUE)",
    },
  ]);
  const applied = yield* readHistory(executor, migrations);
  for (const migration of migrations.slice(applied)) {
    yield* executor.batch([
      ...migration.sql.map((sql) => ({ params: [], sql })),
      {
        params: [migration.hash, migration.folderMillis],
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      },
    ]);
  }
  if ((yield* readHistory(executor, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return migrations.length - applied;
});

const bootstrapDatabase = Effect.fn("bootstrapDatabase")(function* bootstrapDatabase(
  executor: DatabaseExecutor,
  email: typeof EmailAddress.Type,
) {
  const migrations = yield* loadRemoteMigrations();
  if ((yield* readHistory(executor, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
  }
  const compiled = new SQLiteAsyncDialect().sqlToQuery(bootstrapStatement(email));
  const params = yield* Schema.decodeUnknownEffect(StatementParams)(compiled.params).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" })),
  );
  const [rows] = yield* executor.batch([{ params, sql: compiled.sql }]);
  if (rows?.length !== 1) {
    return yield* fail("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  }
  yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(rows[0]).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );
});

export { bootstrapDatabase, loadRemoteMigrations, migrateDatabase };
export type { DatabaseExecutor, RemoteQuery };
