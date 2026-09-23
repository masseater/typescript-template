import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { Effect, Schema } from "effect";

import { RemoteFailure } from "./remote-input.ts";

import type { SQLiteExecuteMethod } from "drizzle-orm/sqlite-core";

const D1_API_TIMEOUT_MS = 30_000;
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
          redirect: "manual",
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
}): SqliteRemoteDatabase => {
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
  return drizzle((...query: readonly [string, readonly unknown[], SQLiteExecuteMethod]) =>
    run({ method: query[2], params: query[1], sql: query[0] }),
  );
};

export { remoteDatabase };
