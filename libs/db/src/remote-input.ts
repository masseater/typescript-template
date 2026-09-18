import { Effect, Schema } from "effect";

import { EmailAddress } from "./bootstrap-statement.ts";

const RemoteFailureCode = Schema.Literals([
  "REMOTE_COMMAND_INVALID",
  "REMOTE_INPUT_INVALID",
  "REMOTE_TARGET_MISMATCH",
  "REMOTE_QUERY_FAILED",
  "REMOTE_RESPONSE_INVALID",
  "REMOTE_MIGRATIONS_INVALID",
  "REMOTE_MIGRATION_HISTORY_MISMATCH",
  "REMOTE_MIGRATION_HISTORY_MISSING",
  "REMOTE_MIGRATIONS_REQUIRED",
  "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
]);

class RemoteFailure extends Schema.TaggedError<RemoteFailure>()("RemoteFailure", {
  code: RemoteFailureCode,
}) {}

const fail = (code: typeof RemoteFailureCode.Type): Effect.Effect<never, RemoteFailure> => {
  return Effect.fail(new RemoteFailure({ code }));
};

const AccountId = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u));
const DatabaseId = Schema.String.check(
  Schema.isUUID(),
  Schema.makeFilter((value: string) => !value.startsWith("00000000-")),
);
const PLAN_ARGUMENT_COUNT = 2;
const EXECUTE_ARGUMENT_COUNT = 4;

const MIN_API_TOKEN_LENGTH = 20;

const ApiToken = Schema.String.check(
  Schema.isMinLength(MIN_API_TOKEN_LENGTH),
  Schema.isPattern(/^[A-Za-z0-9_-]+$/u),
);

const RemoteTarget = Schema.Struct({
  accountId: AccountId,
  apiToken: Schema.optionalKey(ApiToken),
  databaseId: DatabaseId,
  email: Schema.optionalKey(EmailAddress),
});

const parseRemoteInput = Effect.fn("parseRemoteInput")(function* parseRemoteInput(
  args: readonly string[],
  input: unknown,
) {
  const [operation, mode, confirmationFlag, confirmation] = args;
  if (
    (operation !== "migrate" && operation !== "bootstrap") ||
    !(
      (mode === "--plan" && args.length === PLAN_ARGUMENT_COUNT) ||
      (mode === "--execute" &&
        args.length === EXECUTE_ARGUMENT_COUNT &&
        confirmationFlag === "--confirm-database")
    )
  ) {
    return yield* fail("REMOTE_COMMAND_INVALID");
  }
  const target = yield* Schema.decodeUnknownEffect(RemoteTarget)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })));
  if (
    (operation === "bootstrap" && target.email === undefined) ||
    (operation === "migrate" && target.email !== undefined) ||
    (mode === "--execute" && target.apiToken === undefined)
  ) {
    return yield* fail("REMOTE_INPUT_INVALID");
  }
  if (mode === "--execute" && confirmation !== target.databaseId) {
    return yield* fail("REMOTE_TARGET_MISMATCH");
  }
  return { execute: mode === "--execute", operation, target };
});

export { RemoteFailure, fail, parseRemoteInput };
