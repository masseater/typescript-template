import { Effect, Schema } from "effect";
import { endpoint, readList } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";

const DatabaseList = Schema.Struct({
  result: Schema.Array(Schema.Struct({ name: Schema.String, uuid: Schema.String })),
  success: Schema.Literal(true),
});

function databaseName(prefix: string): string {
  return `${prefix}-db`;
}

function unavailable(keys: readonly string[] = []): CloudflareFailure {
  return new CloudflareFailure({ code: "database_output_unavailable", keys });
}

const findDatabaseId = Effect.fn("findDatabaseId")(function* findDatabaseId(
  access: AccountAccess,
  name: string,
) {
  const listed = yield* readList(
    access,
    { query: { name }, source: endpoint`accounts/${access.accountId}/d1/database` },
    DatabaseList,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ).pipe(Effect.mapError((failure) => unavailable(failure.keys)));
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
