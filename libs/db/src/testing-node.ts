import { Context, Effect, Layer, Schema } from "effect";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { Database } from "./database.ts";
import { Miniflare } from "miniflare";
import type { RemoteFailure } from "./remote-input.ts";
import { localDatabase } from "./local.ts";

const miniflareCompatibilityDate = "2026-07-30";

interface D1RawResponse {
  readonly result: readonly {
    readonly results: { readonly rows: readonly unknown[][] };
    readonly success: true;
  }[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({
  params: Schema.optionalKey(Schema.Array(HttpParam)),
  sql: Schema.String,
});
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@template/db/TestBinding") {}

async function executeD1RawBatch(database: D1Database, body: unknown): Promise<D1RawResponse> {
  const { batch } = await Schema.decodeUnknownPromise(HttpBatch)(body);
  const results = await database.batch<Record<string, unknown>>(
    batch.map(({ params = [], sql }) => database.prepare(sql).bind(...params)),
  );
  return {
    result: results.map(({ results: rows }) => ({
      results: { rows: rows.map((row) => Object.values(row)) },
      success: true,
    })),
    success: true,
  };
}

function failureCode<Value, Requirements>(
  effect: Effect.Effect<Value, RemoteFailure, Requirements>,
): Effect.Effect<RemoteFailure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

function runStatement(
  sql: string,
  ...params: readonly (string | number)[]
): Effect.Effect<D1Result, unknown, TestBinding> {
  return Effect.gen(function* statement() {
    const database = yield* TestBinding;
    return yield* Effect.tryPromise(async () =>
      database
        .prepare(sql)
        .bind(...params)
        .run(),
    );
  });
}

const testBinding: Layer.Layer<TestBinding, RemoteFailure> = Layer.effect(
  TestBinding,
  Effect.acquireRelease(
    Effect.promise(async () => {
      const runtime = new Miniflare({
        compatibilityDate: miniflareCompatibilityDate,
        d1Databases: { [localDatabase.binding]: localDatabase.database_name },
        modules: true,
        script: "export default { fetch() { return new Response('test-database'); } };",
      });
      return { database: await runtime.getD1Database(localDatabase.binding), runtime };
    }),
    ({ runtime }) => Effect.promise(async () => runtime.dispose()),
  ).pipe(Effect.map(({ database }) => database)),
);

const EmptyTestDatabase = Layer.unwrap(
  Effect.gen(function* databaseLayer() {
    return Database.layer(yield* TestBinding);
  }),
).pipe(Layer.provideMerge(testBinding));

export { EmptyTestDatabase, TestBinding, executeD1RawBatch, failureCode, runStatement };
