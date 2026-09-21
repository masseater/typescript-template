import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { Effect, Schema } from "effect";

import { RemoteFailure } from "./remote-input.ts";

import type { MigrationConfig } from "drizzle-orm/migrator";
import type { SQLiteExecuteMethod } from "drizzle-orm/sqlite-core";

type DatabaseExecutor = {
  readonly batch: (
    queries: readonly {
      readonly params: readonly (string | number | null)[];
      readonly sql: string;
    }[],
  ) => Effect.Effect<readonly (readonly unknown[])[], RemoteFailure>;
};

const D1_API_TIMEOUT_MS = 30_000;
const StatementRows = Schema.Struct({
  results: Schema.Array(Schema.Unknown),
  success: Schema.Literal(true),
});
const QueryResponse = Schema.Struct({
  result: Schema.Array(StatementRows),
  success: Schema.Literal(true),
});
const D1RawQueryResponse = Schema.Struct({
  result: Schema.Array(
    Schema.Struct({
      results: Schema.Struct({ rows: Schema.Array(Schema.Array(Schema.Unknown)) }),
      success: Schema.Literal(true),
    }),
  ),
  success: Schema.Literal(true),
});

const queryFailed = (): RemoteFailure => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });

const readJson = (d1Request: {
  readonly endpoint: string;
  readonly apiToken: string;
  readonly payload: unknown;
}): Effect.Effect<unknown, RemoteFailure> => {
  return Effect.gen(function* responseBody() {
    const d1Response = yield* Effect.tryPromise({
      catch: queryFailed,
      try: async (signal) =>
        fetch(d1Request.endpoint, {
          body: JSON.stringify(d1Request.payload),
          headers: {
            authorization: `Bearer ${d1Request.apiToken}`,
            "content-type": "application/json",
          },
          method: "POST",
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(D1_API_TIMEOUT_MS)]),
        }),
    });
    if (!d1Response.ok) {
      return yield* queryFailed();
    }
    return yield* Effect.tryPromise({
      catch: queryFailed,
      try: async (): Promise<unknown> => d1Response.json(),
    });
  });
};

const remoteExecutor = ({
  accountId,
  apiToken,
  databaseId,
}: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly databaseId: string;
}): DatabaseExecutor => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  return {
    batch: (queries) =>
      Effect.gen(function* batch() {
        const responseJson = yield* readJson({
          apiToken,
          endpoint,
          payload: { batch: queries },
        });
        const decoded = yield* Schema.decodeUnknownEffect(QueryResponse)(responseJson).pipe(
          Effect.mapError(queryFailed),
        );
        if (decoded.result.length !== queries.length) {
          return yield* queryFailed();
        }
        return decoded.result.map((statementRows) => statementRows.results);
      }),
  };
};

const postRaw = (d1RawBatch: {
  readonly endpoint: string;
  readonly apiToken: string;
  readonly batch: readonly {
    readonly params?: readonly unknown[];
    readonly sql: string;
  }[];
}): Promise<readonly (readonly (readonly unknown[])[])[]> => {
  return Effect.runPromise(
    Effect.gen(function* rawQuery() {
      const responseJson = yield* readJson({
        apiToken: d1RawBatch.apiToken,
        endpoint: d1RawBatch.endpoint,
        payload: { batch: d1RawBatch.batch },
      });
      const { result } = yield* Schema.decodeUnknownEffect(D1RawQueryResponse)(responseJson).pipe(
        Effect.mapError(queryFailed),
      );
      if (result.length !== d1RawBatch.batch.length) {
        return yield* queryFailed();
      }
      return result.map((rawStatement) => rawStatement.results.rows);
    }),
  );
};

const remoteDatabase = ({
  accountId,
  apiToken,
  databaseId,
}: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly databaseId: string;
}): {
  readonly apply: (config: Readonly<MigrationConfig>) => Promise<unknown>;
  readonly database: SqliteRemoteDatabase;
} => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/raw`;
  const run = async (query: {
    readonly sql: string;
    readonly params: readonly unknown[];
    readonly method: SQLiteExecuteMethod;
  }): Promise<{ rows: unknown[] }> => {
    const [resultRows = []] = await postRaw({
      apiToken,
      batch: [{ params: query.params, sql: query.sql }],
      endpoint,
    });
    const [firstRow] = resultRows;
    return { rows: query.method === "get" ? [...(firstRow ?? [])] : [...resultRows] };
  };
  const database = drizzle((...query: readonly [string, readonly unknown[], SQLiteExecuteMethod]) =>
    run({ method: query[2], params: query[1], sql: query[0] }),
  );
  return {
    apply: async (config) =>
      migrate(
        database,
        async (queries) => {
          if (queries.length === 0) {
            return;
          }
          await postRaw({
            apiToken,
            batch: queries.map((sql) => ({ sql })),
            endpoint,
          });
        },
        config,
      ),
    database,
  };
};

export { remoteDatabase, remoteExecutor };
export type { DatabaseExecutor };
