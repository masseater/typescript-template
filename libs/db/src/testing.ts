import { reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getColumns } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { Database } from "./database.ts";
import { d1Executor } from "./migrate-d1.ts";
import { MigrationFiles, migrateDatabase } from "./remote-operations.ts";
import { schema } from "./schema.ts";

import type { D1Database, D1Result } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly DB: D1Database;
      readonly TEST_MIGRATIONS: unknown;
    }
  }
}

const migrations = Schema.decodeUnknownEffect(MigrationFiles);

const getSchemaShape = (): Record<string, string[]> => {
  return Object.fromEntries(
    Object.entries(schema).map(([tableName, table]) => [tableName, Object.keys(getColumns(table))]),
  );
};

const runStatement = (
  sql: string,
  ...statementParameters: readonly (string | number)[]
): Effect.Effect<D1Result, DatabaseFailure> => {
  return Effect.tryPromise({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: async () =>
      env.DB.prepare(sql)
        .bind(...statementParameters)
        .run(),
  });
};

const testDatabase = (migrated: boolean): Layer.Layer<Database, unknown> => {
  return Layer.unwrap(
    Effect.gen(function* database() {
      yield* Effect.promise(async () => reset());
      if (migrated) {
        yield* migrateDatabase(d1Executor(env.DB), yield* migrations(env.TEST_MIGRATIONS));
      }
      return Database.layer(env.DB);
    }),
  );
};

const TestDatabase = testDatabase(true);
const EmptyTestDatabase = testDatabase(false);

export { bootstrapAdmin } from "./bootstrap-statement.ts";
export {
  addCredential,
  addOAuthGrant,
  addSession,
  addUser,
  oauthGrantCounts,
  recordedAt,
} from "./records-fixture.ts";
export { EmptyTestDatabase, TestDatabase, getSchemaShape, runStatement };
