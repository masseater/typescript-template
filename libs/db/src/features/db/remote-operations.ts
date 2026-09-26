import { repositoryFile } from "@repo/config/repository-root";
import { withSpan } from "@repo/observability";
import { sql } from "drizzle-orm";
import { drizzle as connectD1 } from "drizzle-orm/d1";
import { migrate as applyD1MigrationFiles } from "drizzle-orm/d1/migrator";
import { readMigrationFiles, type MigrationConfig } from "drizzle-orm/migrator";
import { Clock, Effect, Schema } from "effect";

import {
  BOOTSTRAP_KIND,
  BootstrappedAdmin,
  bootstrapStatement,
  type Email,
} from "./bootstrap-statement.ts";

import type { D1Database } from "@cloudflare/workers-types";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

const RemoteFailureCode = Schema.Literals([
  "REMOTE_COMMAND_INVALID",
  "REMOTE_INPUT_INVALID",
  "REMOTE_TARGET_MISMATCH",
  "REMOTE_QUERY_FAILED",
  "REMOTE_RESPONSE_INVALID",
  "REMOTE_MIGRATIONS_INVALID",
  "REMOTE_MIGRATION_HISTORY_MISMATCH",
  "REMOTE_MIGRATION_HISTORY_MISSING",
  "REMOTE_MIGRATIONS_REQUIRED",
  "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
]);

class RemoteFailure extends Schema.TaggedError<RemoteFailure>()("RemoteFailure", {
  code: RemoteFailureCode,
}) {}

const fail = (code: typeof RemoteFailureCode.Type): Effect.Effect<never, RemoteFailure> => {
  return Effect.fail(new RemoteFailure({ code }));
};

const migrationsFolder = repositoryFile("libs/db/migrations/");

const Statement = Schema.Trim.check(Schema.isMinLength(1));
const MigrationFile = Schema.Struct({
  folderMillis: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
  name: Schema.String.check(Schema.isMinLength(1)),
  sql: Schema.Array(Statement).check(Schema.isMinLength(1)),
});
const MigrationFiles = Schema.Array(MigrationFile).check(Schema.isMinLength(1));
type Migration = typeof MigrationFile.Type;

const RowCells = Schema.Array(Schema.Array(Schema.Unknown));
const TableNameRows = Schema.Array(Schema.Tuple([Schema.String]));
const HistoryRows = Schema.Array(Schema.Tuple([Schema.String, Schema.String]));
const BootstrappedRow = Schema.Tuple([
  Schema.Unknown,
  Schema.Unknown,
  Schema.Unknown,
  Schema.Unknown,
]);

const APPLICATION_TABLES = String.raw`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\_%' ESCAPE '\' AND name NOT LIKE '\_cf\_%' ESCAPE '\' AND name NOT IN ('__drizzle_migrations', 'd1_migrations')`;

const MIGRATIONS_TABLE_PRESENT =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'";

const loadRemoteMigrations = Effect.fn("loadRemoteMigrations")(function* loadRemoteMigrations(
  folder: string = migrationsFolder,
) {
  const migrations = yield* Effect.try({
    catch: () => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" }),
    try: () => readMigrationFiles({ migrationsFolder: folder }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(MigrationFiles)),
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" })),
  );
  if (
    migrations.some(
      (migration, index) =>
        index > 0 && migration.folderMillis <= (migrations[index - 1]?.folderMillis ?? 0),
    )
  ) {
    return yield* fail("REMOTE_MIGRATIONS_INVALID");
  }
  return migrations;
});

const queryValues = <Result>(
  database: Readonly<SQLiteAsyncDatabase<"async", Result>>,
  query: Parameters<SQLiteAsyncDatabase<"async", Result>["values"]>[0],
): Effect.Effect<unknown, RemoteFailure> => {
  return Effect.tryPromise({
    catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
    try: () => database.values(query),
  });
};

const listedNames = <Result>(
  database: Readonly<SQLiteAsyncDatabase<"async", Result>>,
  statement: string,
): Effect.Effect<readonly string[], RemoteFailure> => {
  return queryValues(database, sql.raw(statement)).pipe(
    Effect.flatMap((tableNameRows) =>
      Schema.decodeUnknownEffect(TableNameRows)(tableNameRows).pipe(
        Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
      ),
    ),
    Effect.map((tableNameRows) => tableNameRows.map(([tableName]) => tableName)),
  );
};

const decodeHistoryRows = (
  historyRows: unknown,
): Effect.Effect<typeof HistoryRows.Type, RemoteFailure> =>
  Schema.decodeUnknownEffect(HistoryRows)(historyRows).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );

const appliedMigrations = <Result>(
  database: Readonly<SQLiteAsyncDatabase<"async", Result>>,
  migrations: readonly Pick<Migration, "hash" | "name">[],
): Effect.Effect<number, RemoteFailure> => {
  return Effect.gen(function* recordedMigrations() {
    const history =
      (yield* listedNames(database, MIGRATIONS_TABLE_PRESENT)).length === 0
        ? []
        : yield* queryValues(
            database,
            sql`SELECT hash, name FROM __drizzle_migrations ORDER BY id`,
          ).pipe(Effect.flatMap(decodeHistoryRows));
    if (history.length === 0 && (yield* listedNames(database, APPLICATION_TABLES)).length > 0) {
      return yield* fail("REMOTE_MIGRATION_HISTORY_MISSING");
    }
    if (
      history.some(
        ([hash, migrationName], index) =>
          hash !== migrations[index]?.hash || migrationName !== migrations[index].name,
      )
    ) {
      return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
    }
    return history.length;
  });
};

const migrateDatabase = <Result>(
  input: Readonly<{
    readonly database: SQLiteAsyncDatabase<"async", Result>;
    readonly apply: (config: Readonly<MigrationConfig>) => Promise<unknown>;
    readonly folder?: string;
  }>,
): Effect.Effect<number, RemoteFailure> => {
  const folder = input.folder ?? migrationsFolder;
  return Effect.gen(function* migrate() {
    const migrations = yield* loadRemoteMigrations(folder);
    const applied = yield* appliedMigrations(input.database, migrations);
    yield* Effect.tryPromise({
      catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
      try: () => input.apply({ migrationsFolder: folder }),
    });
    if ((yield* appliedMigrations(input.database, migrations)) !== migrations.length) {
      return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
    }
    return migrations.length - applied;
  }).pipe(withSpan("migrateDatabase"));
};

const migrateD1 = (
  binding: D1Database,
  folder: string = migrationsFolder,
): Effect.Effect<number, RemoteFailure> => {
  const database = connectD1(binding);
  return migrateDatabase({
    apply: (config) => applyD1MigrationFiles(database, config),
    database,
    folder,
  });
};

const ALCHEMY_HISTORY_PRESENT =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__alchemy_migrations'";

const deployedMigrations = <Result>(
  database: SQLiteAsyncDatabase<"async", Result>,
  migrations: readonly Pick<Migration, "hash">[],
): Effect.Effect<void, RemoteFailure> => {
  return Effect.gen(function* deployedHistory() {
    if ((yield* listedNames(database, ALCHEMY_HISTORY_PRESENT)).length === 0) {
      return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
    }
    const hashes = yield* listedNames(
      database,
      "SELECT hash FROM __alchemy_migrations ORDER BY id",
    );
    if (hashes.length !== migrations.length) {
      return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
    }
    if (hashes.some((hash, index) => hash !== migrations[index]?.hash)) {
      return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
    }
  });
};

const decodeBootstrappedRows = (
  listed: unknown,
): Effect.Effect<readonly (typeof BootstrappedRow.Type)[], RemoteFailure> =>
  Schema.decodeUnknownEffect(Schema.Array(BootstrappedRow))(listed).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );

const bootstrapDatabase = <Result>(
  input: Readonly<{
    readonly database: SQLiteAsyncDatabase<"async", Result>;
    readonly email: typeof Email.Type;
  }>,
): Effect.Effect<void, RemoteFailure> => {
  return Effect.gen(function* bootstrap() {
    yield* deployedMigrations(input.database, yield* loadRemoteMigrations());
    const bootstrappedRows = yield* queryValues(
      input.database,
      bootstrapStatement({
        bootstrapKind: BOOTSTRAP_KIND.admin,
        email: input.email,
        updatedAt: yield* Clock.currentTimeMillis,
      }),
    ).pipe(Effect.flatMap(decodeBootstrappedRows));
    const [bootstrappedAdministrator] = bootstrappedRows;
    if (bootstrappedRows.length !== 1 || bootstrappedAdministrator === undefined) {
      return yield* fail("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
    }
    const [administratorId, address, role, permission] = bootstrappedAdministrator;
    yield* Schema.decodeUnknownEffect(BootstrappedAdmin)({
      email: address,
      id: administratorId,
      permission,
      role,
    }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })));
  }).pipe(withSpan("bootstrapDatabase"));
};

export {
  RowCells,
  RemoteFailure,
  bootstrapDatabase,
  fail,
  loadRemoteMigrations,
  migrateD1,
  migrateDatabase,
  migrationsFolder,
};
