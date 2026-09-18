import { Context, Effect, Layer, Schema } from "effect";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { Database } from "./database.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { DatabaseSync } from "node:sqlite";
import { Miniflare } from "miniflare";
import type { RemoteFailure } from "./remote-input.ts";
import { localDatabase } from "./local.ts";
import { prepareBatch } from "./migrate-d1.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const miniflareCompatibilityDate = "2026-07-30";

interface D1HttpBatchResponse {
  readonly result: D1Result[];
  readonly success: true;
}

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({ params: Schema.Array(HttpParam), sql: Schema.String });
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@template/db/TestBinding") {}

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

const miniflareD1Directory = "miniflare-D1DatabaseObject";

async function startRuntime(
  persistDirectory: string,
): Promise<{ readonly database: D1Database; readonly runtime: Miniflare }> {
  const runtime = new Miniflare({
    compatibilityDate: miniflareCompatibilityDate,
    d1Databases: { [localDatabase.binding]: localDatabase.database_name },
    d1Persist: persistDirectory,
    modules: true,
    script: "export default { fetch() { return new Response('test-database'); } };",
  });
  return { database: await runtime.getD1Database(localDatabase.binding), runtime };
}

async function materializePersistedDatabase(persistDirectory: string): Promise<void> {
  const { database, runtime } = await startRuntime(persistDirectory);
  await database.prepare("CREATE TABLE materialize_storage (id INTEGER)").run();
  await database.prepare("DROP TABLE materialize_storage").run();
  await runtime.dispose();
}

async function createCloudflareKeyValueTable(persistDirectory: string): Promise<void> {
  await materializePersistedDatabase(persistDirectory);
  const directory = `${persistDirectory}/${miniflareD1Directory}`;
  const files = await readdir(directory);
  for (const name of files.filter(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
  )) {
    const storage = new DatabaseSync(`${directory}/${name}`);
    storage.exec("CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB)");
    storage.close();
  }
}

function bindingLayer(
  prepare?: (persistDirectory: string) => Promise<void>,
): Layer.Layer<TestBinding, RemoteFailure> {
  return Layer.effect(
    TestBinding,
    Effect.acquireRelease(
      Effect.promise(async () => {
        const persistDirectory = await mkdtemp(`${tmpdir()}/template-d1-`);
        await prepare?.(persistDirectory);
        return { ...(await startRuntime(persistDirectory)), persistDirectory };
      }),
      ({ persistDirectory, runtime }) =>
        Effect.promise(async () => {
          await runtime.dispose();
          await rm(persistDirectory, { force: true, recursive: true });
        }),
    ).pipe(Effect.map(({ database }) => database)),
  );
}

const EmptyTestDatabase = Layer.unwrap(
  Effect.gen(function* databaseLayer() {
    return Database.layer(yield* TestBinding);
  }),
).pipe(Layer.provideMerge(bindingLayer()));

const CloudflareInternalTestDatabase = Layer.unwrap(
  Effect.gen(function* databaseLayer() {
    return Database.layer(yield* TestBinding);
  }),
).pipe(Layer.provideMerge(bindingLayer(createCloudflareKeyValueTable)));

export { d1Executor } from "./migrate-d1.ts";
export {
  CloudflareInternalTestDatabase,
  EmptyTestDatabase,
  TestBinding,
  executeD1HttpBatch,
  runStatement,
};
