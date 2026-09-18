import { Effect, Schema } from "effect";
import type { MigrationConfig } from "drizzle-orm/migrator";
import { RemoteFailure } from "./remote-input.ts";
import type { SQLiteExecuteMethod } from "drizzle-orm/sqlite-core";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";

const REQUEST_TIMEOUT_MS = 30_000;
const Rows = Schema.Array(Schema.Array(Schema.Unknown));
const RawRows = Schema.Struct({ rows: Schema.optionalKey(Rows) });
const RawResult = Schema.Struct({
  results: Schema.optionalKey(RawRows),
  success: Schema.Literal(true),
});
const RawResponse = Schema.Struct({
  result: Schema.Array(RawResult),
  success: Schema.Literal(true),
});

interface RemoteDatabase {
  readonly apply: (config: Readonly<MigrationConfig>) => Promise<unknown>;
  readonly database: SqliteRemoteDatabase;
}

function queryFailed(): RemoteFailure {
  return new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });
}

async function postRaw(
  endpoint: string,
  apiToken: string,
  batch: readonly { readonly params?: readonly unknown[]; readonly sql: string }[],
): Promise<readonly (typeof Rows.Type)[]> {
  return Effect.runPromise(
    Effect.gen(function* request() {
      const response = yield* Effect.tryPromise({
        catch: queryFailed,
        try: async (signal) =>
          fetch(endpoint, {
            body: JSON.stringify({ batch }),
            headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
            method: "POST",
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
          }),
      });
      if (!response.ok) {
        return yield* queryFailed();
      }
      const body = yield* Effect.tryPromise({
        catch: queryFailed,
        try: async (): Promise<unknown> => response.json(),
      });
      const { result } = yield* Schema.decodeUnknownEffect(RawResponse)(body).pipe(
        Effect.mapError(queryFailed),
      );
      if (result.length !== batch.length) {
        return yield* queryFailed();
      }
      return result.map((item) => item.results?.rows ?? []);
    }),
  );
}

function remoteDatabase({
  accountId,
  apiToken,
  databaseId,
}: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly databaseId: string;
}): RemoteDatabase {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/raw`;
  async function run(
    sql: string,
    params: readonly unknown[],
    method: SQLiteExecuteMethod,
  ): Promise<{ rows: unknown[] }> {
    const [rows = []] = await postRaw(endpoint, apiToken, [{ params, sql }]);
    return { rows: method === "get" ? [...(rows[0] ?? [])] : [...rows] };
  }
  async function runBatch(
    queries: readonly { readonly params: readonly unknown[]; readonly sql: string }[],
  ): Promise<{ rows: unknown[] }[]> {
    const results = await postRaw(endpoint, apiToken, queries);
    return results.map((rows) => ({ rows: [...rows] }));
  }
  const database = drizzle(run, runBatch);
  return {
    apply: async (config) =>
      migrate(
        database,
        async (queries) => {
          if (queries.length === 0) {
            return;
          }
          await postRaw(
            endpoint,
            apiToken,
            queries.map((sql) => ({ sql })),
          );
        },
        config,
      ),
    database,
  };
}

export { remoteDatabase };
