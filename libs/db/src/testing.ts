/// <reference types="@cloudflare/vitest-plugin/types" />
/// <reference types="@cloudflare/workers-types" />
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getColumns } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { Database } from "./database.ts";
import { schema } from "./schema.ts";

import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { D1Migration } from "cloudflare:test";

declare global {
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
  ...params: readonly (string | number | null)[]
): Effect.Effect<D1Result, DatabaseFailure> {
  return Effect.tryPromise({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: () =>
      env.DB.prepare(sql)
        .bind(...params)
        .run(),
  });
}

function testDatabase(migrated: boolean): Layer.Layer<Database> {
  return Layer.unwrap(
    Effect.gen(function* database() {
      yield* Effect.promise(() => reset());
      if (migrated) {
        yield* Effect.promise(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
      }
      return Database.layer(env.DB);
    }).pipe(Effect.orDie),
  );
}

const TestDatabase = testDatabase(true);
const EmptyTestDatabase = testDatabase(false);

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

export { BOOTSTRAP_KIND, BootstrapKind, bootstrapAdmin } from "./bootstrap-statement.ts";
export { addSession, addUser, auditActionsOf } from "./records-fixture.ts";
export { EmptyTestDatabase, TestDatabase, capturePrepares, getSchemaShape, runStatement };
