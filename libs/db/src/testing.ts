import { Context, Effect, Layer, Schema } from "effect";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { migrateD1, prepareBatch } from "./migrate-d1.ts";
import { Database } from "./database.ts";
import { Miniflare } from "miniflare";
import type { RemoteFailure } from "./remote-input.ts";
import { getColumns } from "drizzle-orm";
import { schema } from "./schema.ts";

interface D1HttpBatchResponse {
  readonly result: D1Result[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({ params: Schema.Array(HttpParam), sql: Schema.String });
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@template/db/TestBinding") {}

function getSchemaShape(): Record<string, string[]> {
  return Object.fromEntries(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getColumns(table))]),
  );
}

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

function testBinding(migrated: boolean): Layer.Layer<TestBinding, RemoteFailure> {
  return Layer.effect(
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
    ).pipe(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      Effect.tap(({ database }) => (migrated ? migrateD1(database) : Effect.void)),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      Effect.map(({ database }) => database),
    ),
  );
}

const databaseLayer = Layer.unwrap(
  Effect.gen(function* databaseLayer() {
    return Database.layer(yield* TestBinding);
  }),
);

const TestDatabase = databaseLayer.pipe(Layer.provideMerge(testBinding(true)));

const EmptyTestDatabase = databaseLayer.pipe(Layer.provideMerge(testBinding(false)));

export { bootstrapAdmin } from "./bootstrap-statement.ts";
export { d1Executor } from "./migrate-d1.ts";
export {
  EmptyTestDatabase,
  TestBinding,
  TestDatabase,
  executeD1HttpBatch,
  getSchemaShape,
  runStatement,
};
