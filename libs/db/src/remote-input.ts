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
  "REMOTE_MIGRATIONS_REQUIRED",
  "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
]);

export class RemoteFailure extends Schema.TaggedError<RemoteFailure>()("RemoteFailure", {
  code: RemoteFailureCode,
}) {}

export const fail = (code: typeof RemoteFailureCode.Type) =>
  Effect.fail(new RemoteFailure({ code }));

const AccountId = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/));
const DatabaseId = Schema.String.check(
  Schema.isUUID(),
  Schema.makeFilter((value: string) => !value.startsWith("00000000-")),
);
const ApiToken = Schema.String.check(Schema.isMinLength(20), Schema.isPattern(/^[A-Za-z0-9_-]+$/));

const RemoteTarget = Schema.Struct({
  accountId: AccountId,
  databaseId: DatabaseId,
  apiToken: Schema.optionalKey(ApiToken),
  email: Schema.optionalKey(EmailAddress),
});

export const parseRemoteInput = Effect.fn("parseRemoteInput")(function* (
  args: readonly string[],
  input: unknown,
) {
  const [operation, mode, confirmationFlag, confirmation] = args;
  if (
    (operation !== "migrate" && operation !== "bootstrap") ||
    !(
      (mode === "--plan" && args.length === 2) ||
      (mode === "--execute" && args.length === 4 && confirmationFlag === "--confirm-database")
    )
  )
    return yield* fail("REMOTE_COMMAND_INVALID");
  const target = yield* Schema.decodeUnknownEffect(RemoteTarget)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })));
  if (
    (operation === "bootstrap" && target.email === undefined) ||
    (operation === "migrate" && target.email !== undefined) ||
    (mode === "--execute" && target.apiToken === undefined)
  )
    return yield* fail("REMOTE_INPUT_INVALID");
  if (mode === "--execute" && confirmation !== target.databaseId)
    return yield* fail("REMOTE_TARGET_MISMATCH");
  return { operation, execute: mode === "--execute", target };
});
