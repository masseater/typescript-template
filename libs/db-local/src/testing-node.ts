import { workerCompatibility } from "@repo/config/worker";
import { Database } from "@repo/db";
import { localDatabase } from "@repo/db/local";
import { Context, Effect, Layer, Schema } from "effect";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import type { RemoteFailure } from "../../db/src/remote-input.ts";

const HttpParam = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
const HttpQuery = Schema.Struct({
  params: Schema.optionalKey(Schema.Array(HttpParam)),
  sql: Schema.String,
});
const HttpBatch = Schema.Struct({ batch: Schema.Array(HttpQuery) });

const boundStatements = async (
  database: D1Database,
  requestJson: unknown,
): Promise<D1PreparedStatement[]> => {
  const { batch } = await Schema.decodeUnknownPromise(HttpBatch)(requestJson);
  return batch.map((query) => database.prepare(query.sql).bind(...(query.params ?? [])));
};

const executeD1HttpBatch = async (
  database: D1Database,
  requestJson: unknown,
): Promise<{ readonly result: D1Result[]; readonly success: true }> => {
  const executedStatements = await database.batch(await boundStatements(database, requestJson));
  return { result: executedStatements, success: true };
};

const ColumnRecord = Schema.Record(Schema.String, Schema.Unknown);

const columnValues = (columnRecord: unknown): readonly unknown[] =>
  Object.values(Schema.decodeUnknownSync(ColumnRecord)(columnRecord));

const executeD1RawBatch = async (
  database: D1Database,
  requestJson: unknown,
): Promise<{
  readonly result: readonly {
    readonly results: { readonly rows: readonly (readonly unknown[])[] };
    readonly success: true;
  }[];
  readonly success: true;
}> => {
  const executedStatements = await database.batch(await boundStatements(database, requestJson));
  return {
    result: executedStatements.map((executedStatement) => ({
      results: {
        rows: executedStatement.results.map((columnRecord) => columnValues(columnRecord)),
      },
      success: true,
    })),
    success: true,
  };
};

class TestBinding extends Context.Service<TestBinding, D1Database>()("@repo/db/TestBinding") {}

const runStatement = (
  sql: string,
  ...bindings: readonly (string | number)[]
): Effect.Effect<D1Result, unknown, TestBinding> =>
  Effect.gen(function* statement() {
    const database = yield* TestBinding;
    return yield* Effect.tryPromise(async () =>
      database
        .prepare(sql)
        .bind(...bindings)
        .run(),
    );
  });

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

const PrimaryKeyColumn = Schema.Struct({ pk: Schema.Unknown });

const isPrimaryKeyColumn = (column: unknown): boolean =>
  Schema.decodeUnknownSync(PrimaryKeyColumn)(column).pk === 1;

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

const NotNullColumn = Schema.Struct({ notnull: Schema.Unknown });

const notNullFlag = (column: unknown): unknown =>
  Schema.decodeUnknownSync(NotNullColumn)(column).notnull;

const primaryKeyFlagsOf = Effect.fn("primaryKeyFlagsOf")(function* primaryKeyFlagsOf(
  table: string,
) {
  const columns = yield* pragmaRows({ pragma: "table_info", table });
  return columns.filter(isPrimaryKeyColumn).map(notNullFlag);
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

export { localDatabasePlatform } from "./local-platform.ts";
export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, executeD1RawBatch, runStatement };
