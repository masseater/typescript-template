import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { Effect, Layer } from "effect";
import { applyD1Migrations, reset } from "cloudflare:test";
import type { D1Migration } from "cloudflare:test";
import { Database } from "./database.ts";
import { DatabaseFailure } from "./database-failure.ts";
import { env } from "cloudflare:workers";
import { getColumns } from "drizzle-orm";
import { schema } from "./schema.ts";

declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace Cloudflare {
    interface Env {
      readonly DB: D1Database;
      readonly TEST_MIGRATIONS: D1Migration[];
    }
  }
}

function getSchemaShape(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getColumns(table))]),
  );
}

function runStatement(
  sql: string,
  ...params: readonly (string | number)[]
): Effect.Effect<D1Result, DatabaseFailure> {
  return Effect.tryPromise({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: async () =>
      env.DB.prepare(sql)
        .bind(...params)
        .run(),
  });
}

function testDatabase(migrated: boolean): Layer.Layer<Database, unknown> {
  return Layer.unwrap(
    Effect.gen(function* database() {
      yield* Effect.promise(async () => reset());
      if (migrated) {
        yield* Effect.promise(async () => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
      }
      return Database.layer(env.DB);
    }),
  );
}

const TestDatabase = testDatabase(true);
const EmptyTestDatabase = testDatabase(false);

export { bootstrapAdmin } from "./bootstrap-statement.ts";
export { EmptyTestDatabase, TestDatabase, getSchemaShape, runStatement };
