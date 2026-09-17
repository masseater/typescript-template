import { Effect, Schema } from "effect";
import { RemoteCredentials, RemoteFailure } from "./remote-input.ts";
import type { DatabaseExecutor } from "./remote-operations.ts";

const QueryResponse = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Array(
    Schema.Struct({ success: Schema.Literal(true), results: Schema.Array(Schema.Unknown) }),
  ),
});

const queryFailed = () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" });

export const remoteExecutor = Effect.fn("remoteExecutor")(function* (input: unknown) {
  const { accountId, databaseId, apiToken } = yield* Schema.decodeUnknownEffect(RemoteCredentials)(
    input,
  ).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })));
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const executor: DatabaseExecutor = {
    batch: (queries) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(endpoint, {
              method: "POST",
              headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
              body: JSON.stringify({ batch: queries }),
              signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
              redirect: "error",
            }),
          catch: queryFailed,
        });
        if (!response.ok) return yield* queryFailed();
        const body = yield* Effect.tryPromise({ try: () => response.json(), catch: queryFailed });
        const decoded = yield* Schema.decodeUnknownEffect(QueryResponse)(body).pipe(
          Effect.mapError(queryFailed),
        );
        if (decoded.result.length !== queries.length) return yield* queryFailed();
        return decoded.result.map((item) => item.results);
      }),
  };
  return executor;
});
