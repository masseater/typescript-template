import { workerCompatibility } from "@repo/config/worker";
import { Database } from "@repo/db";
import { localDatabase } from "@repo/db/local";
import { prepareBatch } from "@repo/db/migrate-d1";
import { Context, Effect, Layer, Schema } from "effect";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { RemoteFailure } from "@repo/db/remote-input";

interface D1HttpBatchResponse {
  readonly result: D1Result[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({ params: Schema.Array(HttpParam), sql: Schema.String });
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

async function executeD1HttpBatch(
  database: D1Database,
  body: unknown,
): Promise<D1HttpBatchResponse> {
  const { batch } = await Schema.decodeUnknownPromise(HttpBatch)(body);
  const result = await database.batch(prepareBatch(database, batch));
  return { result, success: true };
}

class TestBinding extends Context.Service<TestBinding, D1Database>()("@repo/db/TestBinding") {}

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
      const runtime = new Miniflare(
        convertV4MiniflareOptions({
          compatibilityDate: workerCompatibility.date,
          compatibilityFlags: [...workerCompatibility.flags],
          d1Databases: { [localDatabase.binding]: localDatabase.database_name },
          modules: true,
          script: "export default { fetch() { return new Response('test-database'); } };",
        }),
      );
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

export { d1Executor } from "@repo/db/migrate-d1";
export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, runStatement };
