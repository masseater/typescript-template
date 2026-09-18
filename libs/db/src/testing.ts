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

const getSchemaShape = function getSchemaShape(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getColumns(table))]),
  );
};

const runStatement = function runStatement(
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
};

const testDatabase = function testDatabase(migrated: boolean): Layer.Layer<Database> {
  return Layer.orDie(
    Layer.unwrap(
      Effect.gen(function* database() {
        yield* Effect.promise(async () => reset());
        if (migrated) {
          yield* migrateDatabase(d1Executor(env.DB), yield* migrations(env.TEST_MIGRATIONS));
        }
        return Database.layer(env.DB);
      }),
    ),
  );
};

const TestDatabase = testDatabase(true);
const EmptyTestDatabase = testDatabase(false);

const runTest = <A, E, R>(
  program: Effect.Effect<A, E, R>,
  options: { readonly layer?: Layer.Layer<R> } = {},
): Promise<A> =>
  Effect.runPromise(
    Effect.orDie(program.pipe(Effect.provide(options.layer ?? (TestDatabase as Layer.Layer<R>)))),
  );

function capturePrepares<Requirements>(
  run: Effect.Effect<void, unknown, Requirements>,
): Effect.Effect<readonly string[], unknown, Requirements> {
  return Effect.gen(function* capturePreparesProgram() {
    const statements: string[] = [];
    const prepare = env.DB.prepare.bind(env.DB);
    Object.defineProperty(env.DB, "prepare", {
      configurable: true,
      value: (sql: string) => {
        statements.push(sql);
        return prepare(sql);
      },
    });
    yield* Effect.ensuring(
      run,
      Effect.sync(() => {
        Object.defineProperty(env.DB, "prepare", { configurable: true, value: prepare });
      }),
    );
    return statements;
  });
}

export { bootstrapAdmin } from "./bootstrap-statement.ts";
export {
  addCredential,
  addOAuthGrant,
  addSession,
  addUser,
  oauthGrantCounts,
  recordedAt,
} from "./records-fixture.ts";
export { EmptyTestDatabase, TestDatabase, capturePrepares, getSchemaShape, runStatement, runTest };
