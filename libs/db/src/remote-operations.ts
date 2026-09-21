// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { URL, fileURLToPath } from "node:url";

import { withSpan } from "@repo/observability";
import { sql } from "drizzle-orm";
import { drizzle as connectD1 } from "drizzle-orm/d1";
import { migrate as applyD1MigrationFiles } from "drizzle-orm/d1/migrator";
import { readMigrationFiles, type MigrationConfig } from "drizzle-orm/migrator";
import { Effect, Schema } from "effect";

import { BootstrappedAdmin, bootstrapStatement, type Email } from "./bootstrap-statement.ts";
import { remoteDatabase, remoteExecutor, type DatabaseExecutor } from "./remote-http.ts";
import {
  RemoteFailure,
  fail,
  parseRemoteInput,
  type MigrationStatusTarget,
} from "./remote-input.ts";

import type { D1Database } from "@cloudflare/workers-types";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

const migrationsFolder = fileURLToPath(new URL("../migrations/", import.meta.url));

const Statement = Schema.Trim.check(Schema.isMinLength(1));
const MigrationFile = Schema.Struct({
  folderMillis: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
  name: Schema.String.check(Schema.isMinLength(1)),
  sql: Schema.Array(Statement).check(Schema.isMinLength(1)),
});
const MigrationFiles = Schema.Array(MigrationFile).check(Schema.isMinLength(1));
type Migration = typeof MigrationFile.Type;

const TableNameRows = Schema.Array(Schema.Tuple([Schema.String]));
const HistoryRows = Schema.Array(Schema.Tuple([Schema.String, Schema.String]));
const History = Schema.Array(Schema.Struct({ hash: Schema.String, name: Schema.String }));
const BootstrappedRow = Schema.Tuple([Schema.Unknown, Schema.Unknown, Schema.Unknown]);

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
  database: SQLiteAsyncDatabase<"async", Result>,
  query: Parameters<SQLiteAsyncDatabase<"async", Result>["values"]>[0],
): Effect.Effect<unknown, RemoteFailure> => {
  return Effect.tryPromise({
    catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
    try: async () => database.values(query),
  });
};

const listedNames = <Result>(
  database: SQLiteAsyncDatabase<"async", Result>,
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
  database: SQLiteAsyncDatabase<"async", Result>,
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

const migrateDatabase = <Result>(input: {
  readonly database: SQLiteAsyncDatabase<"async", Result>;
  readonly apply: (config: Readonly<MigrationConfig>) => Promise<unknown>;
  readonly folder?: string;
}): Effect.Effect<number, RemoteFailure> => {
  const folder = input.folder ?? migrationsFolder;
  return Effect.gen(function* migrate() {
    const migrations = yield* loadRemoteMigrations(folder);
    const applied = yield* appliedMigrations(input.database, migrations);
    yield* Effect.tryPromise({
      catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
      try: async () => input.apply({ migrationsFolder: folder }),
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
    apply: async (config) => applyD1MigrationFiles(database, config),
    database,
    folder,
  });
};

const readHistory = Effect.fn("readHistory")(function* readHistory(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  const [historyRows] = yield* executor.batch([
    { params: [], sql: "SELECT hash, name FROM __drizzle_migrations ORDER BY id" },
  ]);
  const history = yield* Schema.decodeUnknownEffect(History)(historyRows).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" })),
  );
  if (
    history.some(
      (appliedMigration, index) =>
        appliedMigration.hash !== migrations.at(index)?.hash ||
        appliedMigration.name !== migrations.at(index)?.name,
    )
  ) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return history.length;
});

const applicationTables = Effect.fn("applicationTables")(function* applicationTables(
  executor: DatabaseExecutor,
) {
  const [listedTables] = yield* executor.batch([{ params: [], sql: APPLICATION_TABLES }]);
  if (listedTables === undefined) {
    return yield* fail("REMOTE_RESPONSE_INVALID");
  }
  return listedTables.length;
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
  const declared = migrations.length;
  const unrecorded = applied === 0 && (yield* applicationTables(executor)) > 0;
  return {
    applied,
    declared,
    pending: declared - applied,
    state: unrecorded ? ("unrecorded" as const) : ("recorded" as const),
  } as const;
});

const readMigrationStatus = Effect.fn("readMigrationStatus")(function* readMigrationStatus(
  d1Database: typeof MigrationStatusTarget.Type,
) {
  return yield* migrationStatus(remoteExecutor(d1Database), yield* loadRemoteMigrations());
});

const decodeBootstrappedRows = (
  listed: unknown,
): Effect.Effect<readonly (typeof BootstrappedRow.Type)[], RemoteFailure> =>
  Schema.decodeUnknownEffect(Schema.Array(BootstrappedRow))(listed).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );

const bootstrapDatabase = <Result>(input: {
  readonly database: SQLiteAsyncDatabase<"async", Result>;
  readonly email: typeof Email.Type;
}): Effect.Effect<void, RemoteFailure> => {
  return Effect.gen(function* bootstrap() {
    const migrations = yield* loadRemoteMigrations();
    if ((yield* appliedMigrations(input.database, migrations)) !== migrations.length) {
      return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
    }
    const bootstrappedRows = yield* queryValues(
      input.database,
      bootstrapStatement(input.email),
    ).pipe(Effect.flatMap(decodeBootstrappedRows));
    const [bootstrappedAdministrator] = bootstrappedRows;
    if (bootstrappedRows.length !== 1 || bootstrappedAdministrator === undefined) {
      return yield* fail("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
    }
    const [administratorId, address, role] = bootstrappedAdministrator;
    yield* Schema.decodeUnknownEffect(BootstrappedAdmin)({
      email: address,
      id: administratorId,
      role,
    }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })));
  }).pipe(withSpan("bootstrapDatabase"));
};

export {
  APPLICATION_TABLES,
  MIGRATIONS_TABLE_PRESENT,
  bootstrapDatabase,
  fail,
  loadRemoteMigrations,
  migrateD1,
  migrateDatabase,
  migrationsFolder,
  parseRemoteInput,
  readMigrationStatus,
  remoteDatabase,
};
