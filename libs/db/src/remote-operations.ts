import { BootstrappedAdmin, bootstrapStatement } from "./bootstrap-statement.ts";
import { Effect, Schema } from "effect";
import type { MigrationConfig, MigrationMeta } from "drizzle-orm/migrator";
import { RemoteFailure, fail } from "./remote-input.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { URL, fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import type { EmailAddress } from "./bootstrap-statement.ts";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/d1";
import { migrate } from "drizzle-orm/d1/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";

const migrationsFolder = fileURLToPath(new URL("../migrations/", import.meta.url));

const APPLICATION_TABLES = String.raw`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\_%' ESCAPE '\' AND name NOT LIKE '\_cf\_%' ESCAPE '\' AND name NOT IN ('__drizzle_migrations', 'd1_migrations')`;

const HISTORY_TABLE =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'";

const Names = Schema.Array(Schema.Tuple([Schema.String]));
const History = Schema.Array(Schema.Tuple([Schema.String, Schema.String]));
const BootstrappedRow = Schema.Tuple([Schema.Unknown, Schema.Unknown, Schema.Unknown]);

function queried<Value>(run: () => Promise<Value>): Effect.Effect<Value, RemoteFailure> {
  return Effect.tryPromise({
    catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
    try: run,
  });
}

function decoded<Type, Encoded>(
  schema: Schema.Codec<Type, Encoded>,
  input: unknown,
): Effect.Effect<Type, RemoteFailure> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_RESPONSE_INVALID" })),
  );
}

function names(
  database: SQLiteAsyncDatabase<"async", unknown>,
  statement: string,
): Effect.Effect<readonly string[], RemoteFailure> {
  return queried(async () => database.values(sql.raw(statement))).pipe(
    Effect.flatMap((rows) => decoded(Names, rows)),
    Effect.map((rows) => rows.map(([name]) => name)),
  );
}

const loadMigrations = Effect.fn("loadMigrations")(function* loadMigrations(
  folder: string = migrationsFolder,
) {
  const migrations = yield* Effect.try({
    catch: () => new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" }),
    try: () => readMigrationFiles({ migrationsFolder: folder }),
  });
  if (migrations.length === 0) {
    return yield* fail("REMOTE_MIGRATIONS_INVALID");
  }
  return migrations;
});

const appliedMigrations = Effect.fn("appliedMigrations")(function* appliedMigrations(
  database: SQLiteAsyncDatabase<"async", unknown>,
  migrations: readonly MigrationMeta[],
) {
  const history =
    (yield* names(database, HISTORY_TABLE)).length === 0
      ? []
      : yield* decoded(
          History,
          yield* queried(async () =>
            database.values(sql`SELECT hash, name FROM __drizzle_migrations ORDER BY id`),
          ),
        );
  if (history.length === 0 && (yield* names(database, APPLICATION_TABLES)).length > 0) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISSING");
  }
  if (
    history.some(
      ([hash, name], index) =>
        hash !== migrations.at(index)?.hash || name !== migrations.at(index)?.name,
    )
  ) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return history.length;
});

const migrateDatabase = Effect.fn("migrateDatabase")(function* migrateDatabase(
  database: SQLiteAsyncDatabase<"async", unknown>,
  apply: (config: Readonly<MigrationConfig>) => Promise<unknown>,
  folder: string = migrationsFolder,
) {
  const migrations = yield* loadMigrations(folder);
  const applied = yield* appliedMigrations(database, migrations);
  yield* queried(async () => apply({ migrationsFolder: folder }));
  if ((yield* appliedMigrations(database, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return migrations.length - applied;
});

function migrateD1(binding: D1Database, folder?: string): Effect.Effect<number, RemoteFailure> {
  const database = drizzle(binding);
  return migrateDatabase(database, async (config) => migrate(database, config), folder);
}

const bootstrapDatabase = Effect.fn("bootstrapDatabase")(function* bootstrapDatabase(
  database: SQLiteAsyncDatabase<"async", unknown>,
  email: typeof EmailAddress.Type,
) {
  const migrations = yield* loadMigrations();
  if ((yield* appliedMigrations(database, migrations)) !== migrations.length) {
    return yield* fail("REMOTE_MIGRATIONS_REQUIRED");
  }
  const rows = yield* queried(async () => database.values(bootstrapStatement(email)));
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    return yield* fail("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  }
  const [id, address, role] = yield* decoded(BootstrappedRow, row);
  yield* decoded(BootstrappedAdmin, { email: address, id, role });
});

const workerMigrations = Effect.fn("workerMigrations")(function* workerMigrations() {
  const migrations = yield* loadMigrations();
  return migrations.map(({ name, sql: queries }) => ({ name, queries }));
});

export {
  APPLICATION_TABLES,
  bootstrapDatabase,
  loadMigrations,
  migrateD1,
  migrateDatabase,
  migrationsFolder,
  workerMigrations,
};
