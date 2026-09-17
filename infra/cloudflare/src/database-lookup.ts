import { Effect, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";

const REQUEST_TIMEOUT_MS = 30_000;

const DatabaseList = Schema.Struct({
  result: Schema.Array(Schema.Struct({ name: Schema.String, uuid: Schema.String })),
  success: Schema.Literal(true),
});

function unavailable(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_output_unavailable", keys: [] });
}

const listDatabases = Effect.fn("listDatabases")(function* listDatabases(target: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly name: string;
}) {
  const endpoint = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database`,
  );
  endpoint.searchParams.set("name", target.name);
  const response = yield* Effect.tryPromise({
    catch: unavailable,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    try: async (signal) =>
      fetch(endpoint, {
        headers: { authorization: `Bearer ${target.apiToken}` },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      }),
  });
  if (!response.ok) {
    return yield* Effect.fail(unavailable());
  }
  const body = yield* Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<unknown> => response.json(),
  });
  return yield* Schema.decodeUnknownEffect(DatabaseList)(body).pipe(Effect.mapError(unavailable));
});

const findDatabaseId = Effect.fn("findDatabaseId")(function* findDatabaseId(target: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly name: string;
}) {
  const listed = yield* listDatabases(target);
  const matches = listed.result.filter((database) => database.name === target.name);
  if (matches.length > 1) {
    return yield* Effect.fail(unavailable());
  }
  return matches[0]?.uuid;
});

const lookupDatabaseId = Effect.fn("lookupDatabaseId")(function* lookupDatabaseId(target: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly name: string;
}) {
  const found = yield* findDatabaseId(target);
  if (found === undefined) {
    return yield* Effect.fail(unavailable());
  }
  return found;
});

export { findDatabaseId, lookupDatabaseId };
