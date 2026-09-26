import { RowCells, RemoteFailure } from "@repo/db/migrations";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

import type { SQLiteExecuteMethod } from "drizzle-orm/sqlite-core";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

const D1_API_TIMEOUT_MS = 30_000;
const RawResponse = Schema.Struct({
  result: Schema.Array(
    Schema.Struct({
      results: Schema.Struct({ rows: RowCells }),
      success: Schema.Literal(true),
    }),
  ),
  success: Schema.Literal(true),
});

const queryFailed = (): RemoteFailure => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });

const d1Http = Layer.merge(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "error" }),
);

const readJson = (
  endpoint: string,
  apiToken: string,
  body: unknown,
): Effect.Effect<unknown, RemoteFailure> =>
  Effect.gen(function* responseBody() {
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

const postRaw = (
  endpoint: string,
  apiToken: string,
  batch: readonly { readonly params?: readonly unknown[]; readonly sql: string }[],
): Effect.Effect<readonly (typeof RowCells.Type)[], RemoteFailure> =>
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
}): SqliteRemoteDatabase => {
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
  return drizzle(run);
};

export { remoteDatabase };
