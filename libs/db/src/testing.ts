import { applyD1Migrations, reset, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getColumns } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { Database } from "./database.ts";
import { schema } from "./schema.ts";

import type { D1Database, D1Result } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly DB: D1Database;
      readonly TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const getSchemaShape = (): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(schema).map(([tableName, table]) => [tableName, Object.keys(getColumns(table))]),
  );

const runStatement = (
  sql: string,
  ...statementParams: readonly (string | number)[]
): Effect.Effect<D1Result, DatabaseFailure> =>
  Effect.tryPromise({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: async () =>
      env.DB.prepare(sql)
        .bind(...statementParams)
        .run(),
  });

const testDatabase = (migrated: boolean): Layer.Layer<Database> =>
  Layer.unwrap(
    Effect.gen(function* database() {
      yield* Effect.promise(async () => reset());
      if (migrated) {
        yield* Effect.promise(async () => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
      }
      return Database.layer(env.DB);
    }).pipe(Effect.orDie),
  );

const TestDatabase = testDatabase(true);
const EmptyTestDatabase = testDatabase(false);

export { bootstrapAdmin } from "./bootstrap-statement.ts";
export { EmptyTestDatabase, TestDatabase, getSchemaShape, runStatement };
