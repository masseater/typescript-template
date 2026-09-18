import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { Context, Effect, Layer, Schema } from "effect";
import { Miniflare } from "miniflare";

import { Database } from "./database.ts";
import { localDatabase } from "./local.ts";
import { prepareBatch } from "./migrate-d1.ts";
import type { RemoteFailure } from "./remote-input.ts";

const miniflareCompatibilityDate = "2026-07-30";

interface D1HttpBatchResponse {
  readonly result: D1Result[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({ params: Schema.Array(HttpParam), sql: Schema.String });
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@repo/db/TestBinding") {}

async function executeD1HttpBatch(
  database: D1Database,
  body: unknown,
): Promise<D1HttpBatchResponse> {
  const { batch } = await Schema.decodeUnknownPromise(HttpBatch)(body);
  const result = await database.batch(prepareBatch(database, batch));
  return { result, success: true };
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

export { d1Executor } from "./migrate-d1.ts";
export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, runStatement };
