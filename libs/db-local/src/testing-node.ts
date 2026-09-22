import { workerCompatibility } from "@repo/config/worker";
import { Database, DatabaseFailure } from "@repo/db";
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
const ColumnObject = Schema.Record(Schema.String, Schema.Unknown);
const TableInfoColumn = Schema.Struct({
  notnull: Schema.Unknown,
  pk: Schema.Unknown,
});

const boundStatements = (
  database: D1Database,
  requestJson: unknown,
): Effect.Effect<D1PreparedStatement[], Schema.SchemaError> =>
  Effect.gen(function* bindStatements() {
    const { batch } = yield* Schema.decodeUnknownEffect(HttpBatch)(requestJson);
    return batch.map((query) => database.prepare(query.sql).bind(...(query.params ?? [])));
  });

const executeD1HttpBatch = (
  database: D1Database,
  requestJson: unknown,
): Effect.Effect<Readonly<{ result: readonly D1Result[]; success: true }>, Schema.SchemaError> =>
  Effect.gen(function* executeHttpBatch() {
    const statements = yield* boundStatements(database, requestJson);
    const executedStatements = yield* Effect.promise(() => database.batch(statements));
    return { result: executedStatements, success: true };
  });

const columnValues = (columnObject: unknown): readonly unknown[] =>
  Effect.runSync(
    Schema.decodeUnknownEffect(ColumnObject)(columnObject).pipe(
      Effect.map((decodedColumn) => Object.values(decodedColumn)),
      Effect.orDie,
    ),
  );

type RawStatementSuccess = Readonly<{
  results: Readonly<{ rows: readonly (readonly unknown[])[] }>;
  success: true;
}>;

const rawStatementSuccess = (
  executedStatement: Readonly<{ results: readonly unknown[] }>,
): RawStatementSuccess => ({
  results: { rows: executedStatement.results.map((columnObject) => columnValues(columnObject)) },
  success: true,
});

const executeD1RawBatch = (
  database: D1Database,
  requestJson: unknown,
): Effect.Effect<
  Readonly<{ result: readonly RawStatementSuccess[]; success: true }>,
  Schema.SchemaError
> =>
  Effect.gen(function* executeRawBatch() {
    const statements = yield* boundStatements(database, requestJson);
    const executedStatements = yield* Effect.promise(() => database.batch(statements));
    return { result: executedStatements.map(rawStatementSuccess), success: true };
  });

class TestBinding extends Context.Service<TestBinding, D1Database>()("@repo/db/TestBinding") {}

const runStatement = (
  sql: string,
  ...bindings: readonly (string | number)[]
): Effect.Effect<D1Result, DatabaseFailure, TestBinding> =>
  Effect.gen(function* statement() {
    const database = yield* TestBinding;
    return yield* Effect.tryPromise({
      catch: (cause) => new DatabaseFailure({ cause }),
      try: () =>
        database
          .prepare(sql)
          .bind(...bindings)
          .run(),
    });
  });

const testBinding: Layer.Layer<TestBinding, RemoteFailure> = Layer.effect(
  TestBinding,
  Effect.acquireRelease(
    Effect.gen(function* openRuntime() {
      const runtime = new Miniflare(
        convertV4MiniflareOptions({
          compatibilityDate: workerCompatibility.date,
          compatibilityFlags: [...workerCompatibility.flags],
          d1Databases: { [localDatabase.binding]: localDatabase.database_name },
          modules: true,
          script: "export default { fetch() { return new Response('test-database'); } };",
        }),
      );
      return {
        database: yield* Effect.promise(() => runtime.getD1Database(localDatabase.binding)),
        runtime,
      };
    }),
    ({ runtime }) => Effect.promise(() => runtime.dispose()),
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

const tableInfoColumn = (
  pragmaRow: Readonly<Record<string, unknown>>,
): typeof TableInfoColumn.Type | undefined =>
  Effect.runSync(
    Schema.decodeUnknownEffect(TableInfoColumn)(pragmaRow).pipe(
      Effect.orElseSucceed((): typeof TableInfoColumn.Type | undefined => undefined),
    ),
  );

const isPrimaryKeyColumn = (pragmaRow: Readonly<Record<string, unknown>>): boolean =>
  tableInfoColumn(pragmaRow)?.pk === 1;

const positionalKeys: ReadonlySet<string> = new Set(["cid", "id", "seq"]);

const comparableRow = (pragmaRow: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(
    Object.keys(pragmaRow)
      .filter(
        (columnName) =>
          !positionalKeys.has(columnName) &&
          !(columnName === "notnull" && isPrimaryKeyColumn(pragmaRow)),
      )
      .toSorted((left, right) => left.localeCompare(right))
      .map((columnName) => [columnName, pragmaRow[columnName]]),
  );

const primaryKeyFlagsOf = Effect.fn("primaryKeyFlagsOf")(function* primaryKeyFlagsOf(
  table: string,
) {
  const columns = yield* pragmaRows({ pragma: "table_info", table });
  return columns.flatMap((pragmaRow) => {
    const column = tableInfoColumn(pragmaRow);
    return column?.pk === 1 ? [column.notnull] : [];
  });
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

export { EmptyTestDatabase, TestBinding, executeD1HttpBatch, executeD1RawBatch, runStatement };
