// oxlint-disable-next-line import/no-nodejs-modules
import { URL, fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import { Effect, Schema } from "effect";

import { BootstrappedAdmin, bootstrapStatement } from "./bootstrap-statement.ts";
import { remoteExecutor } from "./remote-http.ts";
import { RemoteFailure, fail } from "./remote-input.ts";

import type { EmailAddress } from "./bootstrap-statement.ts";
import type { MigrationStatusTarget } from "./remote-input.ts";

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
  name: Schema.String.check(Schema.isMinLength(1)),
  sql: Schema.Array(Statement).check(Schema.isMinLength(1)),
});
const MigrationFiles = Schema.Array(MigrationFile).check(Schema.isMinLength(1));
type Migration = typeof MigrationFile.Type;

const StatementParams = Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Null]));

const History = Schema.Array(Schema.Struct({ hash: Schema.String, name: Schema.String }));

const APPLICATION_TABLES = String.raw`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\_%' ESCAPE '\' AND name NOT LIKE '\_cf\_%' ESCAPE '\' AND name NOT IN ('__drizzle_migrations', 'd1_migrations')`;

const MIGRATIONS_TABLE =
  "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric, name text, applied_at TEXT)";

const MIGRATIONS_TABLE_PRESENT =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'";

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
    { params: [], sql: "SELECT hash, name FROM __drizzle_migrations ORDER BY id" },
  ]);
  const history = yield* Schema.decodeUnknownEffect(History)(rows).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" })),
  );
  if (
    history.some(
      (item, index) =>
        item.hash !== migrations.at(index)?.hash || item.name !== migrations.at(index)?.name,
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
  yield* executor.batch([{ params: [], sql: MIGRATIONS_TABLE }]);
  const applied = yield* readHistory(executor, migrations);
  const [existing] = yield* executor.batch([{ params: [], sql: APPLICATION_TABLES }]);
  if (applied === 0 && existing !== undefined && existing.length > 0) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISSING");
  }
  for (const migration of migrations.slice(applied)) {
    yield* executor.batch([
      ...migration.sql.map((sql) => ({ params: [], sql })),
      {
        params: [migration.hash, migration.folderMillis, migration.name, new Date().toISOString()],
        sql: "INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES (?, ?, ?, ?)",
      },
    ]);
  }
  if ((yield* readHistory(executor, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return migrations.length - applied;
});

const migrationStatus = Effect.fn("migrationStatus")(function* migrationStatus(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  const [recorded] = yield* executor.batch([{ params: [], sql: MIGRATIONS_TABLE_PRESENT }]);
  if (recorded === undefined) {
    return yield* fail("REMOTE_RESPONSE_INVALID");
  }
  const applied = recorded.length === 0 ? 0 : yield* readHistory(executor, migrations);
  return { applied, declared: migrations.length, pending: migrations.length - applied } as const;
});

const readMigrationStatus = Effect.fn("readMigrationStatus")(function* readMigrationStatus(
  target: typeof MigrationStatusTarget.Type,
) {
  return yield* migrationStatus(remoteExecutor(target), yield* loadRemoteMigrations());
});

const bootstrapDatabase = Effect.fn("bootstrapDatabase")(function* bootstrapDatabase(
  executor: DatabaseExecutor,
  email: typeof EmailAddress.Type,
) {
  const migrations = yield* loadRemoteMigrations();
  if ((yield* readHistory(executor, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
  }
  const compiled = new SQLiteDialect().sqlToQuery(bootstrapStatement(email));
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

export {
  APPLICATION_TABLES,
  MigrationFiles,
  bootstrapDatabase,
  MIGRATIONS_TABLE_PRESENT,
  loadRemoteMigrations,
  migrateDatabase,
  readMigrationStatus,
};
export type { DatabaseExecutor, RemoteQuery };
