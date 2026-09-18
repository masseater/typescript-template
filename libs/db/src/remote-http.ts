import { Effect, Schema } from "effect";

import { RemoteFailure } from "./remote-input.ts";

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

const queryFailed = (): RemoteFailure => {
  return new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });
};

const remoteExecutor = ({
  accountId,
  databaseId,
  apiToken,
}: {
  readonly accountId: string;
  readonly databaseId: string;
  readonly apiToken: string;
}): DatabaseExecutor => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  return {
    batch: (queries) =>
      Effect.gen(function* batch() {
        const d1Response = yield* Effect.tryPromise({
          catch: queryFailed,

          try: async (signal) =>
            fetch(endpoint, {
              body: JSON.stringify({ batch: queries }),
              headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
              method: "POST",
              redirect: "error",
              signal: AbortSignal.any([signal, AbortSignal.timeout(D1_API_TIMEOUT_MS)]),
            }),
        });
        if (!d1Response.ok) {
          return yield* queryFailed();
        }
        const responseJson = yield* Effect.tryPromise({
          catch: queryFailed,
          try: async (): Promise<unknown> => d1Response.json(),
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

export { remoteExecutor };
export type { DatabaseExecutor, RemoteQuery };
