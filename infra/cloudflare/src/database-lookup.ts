import { Effect, Schema } from "effect";
import { decodeBody, readJson } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";

const DatabaseList = Schema.Struct({
  result: Schema.Array(Schema.Struct({ name: Schema.String, uuid: Schema.String })),
  success: Schema.Literal(true),
});

function databaseName(prefix: string): string {
  return `${prefix}-db`;
}

function unavailable(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_output_unavailable", keys: [] });
}

const findDatabaseId = Effect.fn("findDatabaseId")(function* findDatabaseId(
  access: AccountAccess,
  name: string,
) {
  const reading = yield* readJson(access.apiToken, `accounts/${access.accountId}/d1/database`, {
    name,
  }).pipe(Effect.mapError(unavailable));
  const listed = yield* decodeBody(DatabaseList, reading.body).pipe(Effect.mapError(unavailable));
  const matches = listed.result.filter((database) => database.name === name);
  if (matches.length > 1) {
    return yield* Effect.fail(unavailable());
  }
  return matches[0]?.uuid;
});

const lookupDatabaseId = Effect.fn("lookupDatabaseId")(function* lookupDatabaseId(
  access: AccountAccess,
  name: string,
) {
  const found = yield* findDatabaseId(access, name);
  if (found === undefined) {
    return yield* Effect.fail(unavailable());
  }
  return found;
});

export { databaseName, findDatabaseId, lookupDatabaseId };
