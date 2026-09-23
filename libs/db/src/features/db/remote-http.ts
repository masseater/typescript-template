import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { RemoteFailure } from "./remote-input.ts";

import type { MigrationConfig } from "drizzle-orm/migrator";
import type { SQLiteExecuteMethod } from "drizzle-orm/sqlite-core";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

interface RemoteQuery {
  readonly params: readonly (string | number | null)[];
  readonly sql: string;
}

interface DatabaseExecutor {
  readonly batch: (
    queries: readonly RemoteQuery[],
  ) => Effect.Effect<readonly (readonly unknown[])[], RemoteFailure>;
}

const D1_API_TIMEOUT_MS = 30_000;
const StatementRows = Schema.Struct({
  results: Schema.Array(Schema.Unknown),
  success: Schema.Literal(true),
});
const QueryResponse = Schema.Struct({
  result: Schema.Array(StatementRows),
  success: Schema.Literal(true),
});
const RawRows = Schema.Array(Schema.Array(Schema.Unknown));
const RawResponse = Schema.Struct({
  result: Schema.Array(
    Schema.Struct({
      results: Schema.Struct({ rows: RawRows }),
      success: Schema.Literal(true),
    }),
  ),
  success: Schema.Literal(true),
});

const queryFailed = (): RemoteFailure => {
  return new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });
};

const d1Http = Layer.merge(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "error" }),
);

const readJson = (
  endpoint: string,
  apiToken: string,
  body: unknown,
): Effect.Effect<unknown, RemoteFailure> => {
  return Effect.gen(function* responseBody() {
    const requestPayload = yield* HttpBody.json(body).pipe(Effect.mapError(queryFailed));
    const d1Response = yield* HttpClient.post(endpoint, {
      body: requestPayload,
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    }).pipe(
      Effect.timeout(`${D1_API_TIMEOUT_MS} millis`),
      Effect.provide(d1Http),
      Effect.mapError(queryFailed),
    );
    if (d1Response.status < 200 || d1Response.status >= 300) {
      return yield* queryFailed();
    }
    return yield* HttpClientResponse.schemaBodyJson(Schema.Unknown)(d1Response).pipe(
      Effect.mapError(queryFailed),
    );
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
        const responseJson = yield* readJson(endpoint, apiToken, { batch: queries });
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

const postRaw = (
  endpoint: string,
  apiToken: string,
  batch: readonly { readonly params?: readonly unknown[]; readonly sql: string }[],
): Effect.Effect<readonly (typeof RawRows.Type)[], RemoteFailure> =>
  Effect.gen(function* request() {
    const responseJson = yield* readJson(endpoint, apiToken, { batch });
    const { result } = yield* Schema.decodeUnknownEffect(RawResponse)(responseJson).pipe(
      Effect.mapError(queryFailed),
    );
    if (result.length !== batch.length) {
      return yield* queryFailed();
    }
    return result.map((item) => item.results.rows);
  });

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
  const run = (
    sql: string,
    params: readonly unknown[],
    method: SQLiteExecuteMethod,
  ): Promise<{ rows: unknown[] }> =>
    Effect.runPromise(
      Effect.gen(function* runRaw() {
        const [rows = []] = yield* postRaw(endpoint, apiToken, [{ params, sql }]);
        const [firstRow] = rows;
        return { rows: method === "get" ? [...(firstRow ?? [])] : [...rows] };
      }),
    );
  const database = drizzle(run);
  return {
    apply: (config) =>
      migrate(
        database,
        (queries) => {
          if (queries.length === 0) {
            return Promise.resolve();
          }
          return Effect.runPromise(
            postRaw(
              endpoint,
              apiToken,
              queries.map((sql) => ({ sql })),
            ).pipe(Effect.asVoid),
          );
        },
        config,
      ),
    database,
  };
};

export { remoteDatabase, remoteExecutor };
export type { DatabaseExecutor };
