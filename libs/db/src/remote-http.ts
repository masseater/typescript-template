import { Effect, Schema } from "effect";

import { RemoteFailure } from "./remote-input.ts";

import type { DatabaseExecutor } from "./remote-operations.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const StatementResult = Schema.Struct({
  results: Schema.Array(Schema.Unknown),
  success: Schema.Literal(true),
});
const QueryResponse = Schema.Struct({
  result: Schema.Array(StatementResult),
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
        const response = yield* Effect.tryPromise({
          catch: queryFailed,

          try: async (signal) =>
            fetch(endpoint, {
              body: JSON.stringify({ batch: queries }),
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
        const decoded = yield* Schema.decodeUnknownEffect(QueryResponse)(body).pipe(
          Effect.mapError(queryFailed),
        );
        if (decoded.result.length !== queries.length) {
          return yield* queryFailed();
        }
        return decoded.result.map((item) => item.results);
      }),
  };
};

export { remoteExecutor };
