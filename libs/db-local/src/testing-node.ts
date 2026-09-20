import { workerCompatibility } from "@repo/config/worker";
import { Database } from "@repo/db";
import { localDatabase } from "@repo/db/local";
import { Context, Effect, Layer, Schema } from "effect";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { prepareBatch } from "../../db/src/migrate-d1.ts";

import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { RemoteFailure } from "../../db/src/remote-input.ts";

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

const NameRows = Schema.Array(Schema.Struct({ name: Schema.String }));
const PragmaRows = Schema.Array(Schema.Record(Schema.String, Schema.Unknown));

export const databaseObjectNames = Effect.fn("databaseObjectNames")(function* databaseObjectNames(
  objectType: "table" | "trigger",
) {
  const listing = yield* runStatement(
    "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA', '__drizzle_migrations') ORDER BY name",
    objectType,
  );
  const nameRows = yield* Schema.decodeUnknownEffect(NameRows)(listing.results);
  return nameRows.map((nameRow) => nameRow.name);
});

const pragmaRows = Effect.fn("pragmaRows")(function* pragmaRows(inspected: {
  readonly pragma: string;
  readonly table: string;
}) {
  const listing = yield* runStatement(`PRAGMA ${inspected.pragma}("${inspected.table}")`);
  return yield* Schema.decodeUnknownEffect(PragmaRows)(listing.results);
});

const isPrimaryKeyColumn = (column: Readonly<Record<string, unknown>>): boolean =>
  column["pk"] === 1;

const positionalKeys: ReadonlySet<string> = new Set(["cid", "id", "seq"]);

const comparableRow = (pragmaRow: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(
    Object.keys(pragmaRow)
      .filter(
        (column) =>
          !positionalKeys.has(column) && !(column === "notnull" && isPrimaryKeyColumn(pragmaRow)),
      )
      .toSorted((left, right) => left.localeCompare(right))
      .map((column) => [column, pragmaRow[column]]),
  );

const primaryKeyFlagsOf = Effect.fn("primaryKeyFlagsOf")(function* primaryKeyFlagsOf(
  table: string,
) {
  const columns = yield* pragmaRows({ pragma: "table_info", table });
  return columns.filter(isPrimaryKeyColumn).map((column) => column["notnull"]);
});

export const primaryKeyNullability = Effect.fn("primaryKeyNullability")(
  function* primaryKeyNullability() {
    const tables = yield* databaseObjectNames("table");
    const primaryKeyFlags = yield* Effect.forEach(tables, primaryKeyFlagsOf);
    return [...new Set(primaryKeyFlags.flat())];
  },
);

const describedRows = Effect.fn("describedRows")(function* describedRows(inspected: {
  readonly pragma: string;
  readonly table: string;
}) {
  const inspectedRows = yield* pragmaRows(inspected);
  return inspectedRows.map((pragmaRow) => `${inspected.pragma} ${comparableRow(pragmaRow)}`);
});

const describeTable = Effect.fn("describeTable")(function* describeTable(table: string) {
  const described = yield* Effect.forEach(
    ["table_info", "index_list", "foreign_key_list"],
    (pragma) => describedRows({ pragma, table }),
  );
  return [table, described.flat().toSorted((left, right) => left.localeCompare(right))] as const;
});

export const describeDatabase = Effect.fn("describeDatabase")(function* describeDatabase() {
  const tables = yield* databaseObjectNames("table");
  const tableShapes = yield* Effect.forEach(tables, describeTable);
  return {
    primaryKeyNotNull: yield* primaryKeyNullability(),
    shape: Object.fromEntries(tableShapes),
    tables,
    triggers: yield* databaseObjectNames("trigger"),
  };
});

export { d1Executor } from "../../db/src/migrate-d1.ts";
export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, runStatement };
