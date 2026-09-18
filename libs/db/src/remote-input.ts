import { CloudflareId } from "@template/config";
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

const DatabaseId = Schema.String.check(
  Schema.isUUID(),
  Schema.makeFilter((databaseId: string) => !databaseId.startsWith("00000000-")),
);
const PLAN_ARGUMENT_COUNT = 2;
const EXECUTE_ARGUMENT_COUNT = 4;

const MIN_API_TOKEN_LENGTH = 20;

const ApiToken = Schema.String.check(
  Schema.isMinLength(MIN_API_TOKEN_LENGTH),
  Schema.isPattern(/^[A-Za-z0-9_-]+$/u),
);

const RemoteTarget = Schema.Struct({
  accountId: CloudflareId,
  apiToken: Schema.optionalKey(ApiToken),
  databaseId: DatabaseId,
  email: Schema.optionalKey(EmailAddress),
});

const parseCommand = (
  commandArguments: readonly string[],
): Effect.Effect<
  {
    readonly operation: "migrate" | "bootstrap";
    readonly execute: boolean;
    readonly confirmation: string | undefined;
  },
  RemoteFailure
> => {
  const [operation, runMode, confirmationFlag, confirmation] = commandArguments;
  const planned = runMode === "--plan" && commandArguments.length === PLAN_ARGUMENT_COUNT;
  const executed =
    runMode === "--execute" &&
    commandArguments.length === EXECUTE_ARGUMENT_COUNT &&
    confirmationFlag === "--confirm-database";
  return (operation === "migrate" || operation === "bootstrap") && (planned || executed)
    ? Effect.succeed({ confirmation, execute: executed, operation })
    : fail("REMOTE_COMMAND_INVALID");
};

export const parseRemoteInput = Effect.fn("parseRemoteInput")(function* parseRemoteInput(
  commandArguments: readonly string[],
  input: unknown,
) {
  const { confirmation, execute, operation } = yield* parseCommand(commandArguments);
  const remoteTarget = yield* Schema.decodeUnknownEffect(RemoteTarget)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })));
  const emailMatchesOperation = (operation === "bootstrap") === (remoteTarget.email !== undefined);
  if (!emailMatchesOperation || (execute && remoteTarget.apiToken === undefined)) {
    return yield* fail("REMOTE_INPUT_INVALID");
  }
  if (execute && confirmation !== remoteTarget.databaseId) {
    return yield* fail("REMOTE_TARGET_MISMATCH");
  }
  return { execute, operation, target: remoteTarget };
});

export { RemoteFailure, fail };
