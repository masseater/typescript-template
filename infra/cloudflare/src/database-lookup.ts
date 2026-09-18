import { Effect, Schema } from "effect";

import { endpoint, readList } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";

import type { AccountAccess, Endpoint } from "./account-read.ts";

const DatabaseList = Schema.Struct({
  result: Schema.Array(Schema.Struct({ name: Schema.String, uuid: Schema.String })),
  success: Schema.Literal(true),
});

const databaseName = (prefix: string): string => {
  return `${prefix}-db`;
};

const databaseSource = (accountId: string): Endpoint => {
  return endpoint`accounts/${accountId}/d1/database`;
};

const unavailable = (keys: readonly string[]): CloudflareFailure => {
  return new CloudflareFailure({ code: "database_output_unavailable", keys });
};

const findDatabaseId = Effect.fn("findDatabaseId")(function* findDatabaseId(
  access: AccountAccess,
  name: string,
) {
  const source = databaseSource(access.accountId);
  const listed = yield* readList(access, { filter: { name }, source }, DatabaseList).pipe(
    Effect.mapError((failure) => unavailable(failure.keys)),
  );
  const matches = listed.result.filter((database) => database.name === name);
  if (matches.length > 1) {
    return yield* Effect.fail(unavailable([source.shape, "ambiguous_name"]));
  }
  return matches[0]?.uuid;
});

const lookupDatabaseId = Effect.fn("lookupDatabaseId")(function* lookupDatabaseId(
  access: AccountAccess,
  name: string,
) {
  const found = yield* findDatabaseId(access, name);
  if (found === undefined) {
    return yield* Effect.fail(unavailable([databaseSource(access.accountId).shape, "absent"]));
  }
  return found;
});

export { databaseName, findDatabaseId, lookupDatabaseId };
