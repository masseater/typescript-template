import { Context, Effect, Layer, Schema } from "effect";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { Database } from "./database.ts";
import { Miniflare } from "miniflare";
import type { RemoteFailure } from "./remote-input.ts";
import { prepareBatch } from "./migrate-d1.ts";

interface D1HttpBatchResponse {
  readonly result: D1Result[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({ params: Schema.Array(HttpParam), sql: Schema.String });
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@template/db/TestBinding") {}

async function executeD1HttpBatch(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
        compatibilityDate: "2026-07-30",
        d1Databases: { DB: "template-test" },
        modules: true,
        script: "export default { fetch() { return new Response('test-database'); } };",
      });
      return { database: await runtime.getD1Database("DB"), runtime };
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    ({ runtime }) => Effect.promise(async () => runtime.dispose()),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ).pipe(Effect.map(({ database }) => database)),
);

const EmptyTestDatabase = Layer.unwrap(
  Effect.gen(function* databaseLayer() {
    return Database.layer(yield* TestBinding);
  }),
).pipe(Layer.provideMerge(testBinding));

export { d1Executor } from "./migrate-d1.ts";
export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, runStatement };
