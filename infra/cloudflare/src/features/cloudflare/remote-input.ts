import { CloudflareId, Email, minimumCloudflareApiTokenLength } from "@repo/config";
import { RemoteFailure, fail } from "@repo/db/migrations";
import { Effect, Schema } from "effect";

const DatabaseId = Schema.String.check(
  Schema.isUUID(),
  Schema.makeFilter((databaseId: string) => !databaseId.startsWith("00000000-")),
);
const PLAN_ARGUMENT_COUNT = 2;
const EXECUTE_ARGUMENT_COUNT = 4;

const ApiToken = Schema.String.check(
  Schema.isMinLength(minimumCloudflareApiTokenLength),
  Schema.isPattern(/^[A-Za-z0-9_-]+$/u),
);

const PlanTarget = Schema.Struct({
  accountId: CloudflareId,
  apiToken: Schema.optionalKey(ApiToken),
  databaseId: DatabaseId,
  email: Email,
});

const ExecuteTarget = Schema.Struct({
  accountId: CloudflareId,
  apiToken: ApiToken,
  databaseId: DatabaseId,
  email: Email,
});

const decodedTarget = <Target>(
  schema: Schema.Codec<Target, unknown>,
  input: unknown,
): Effect.Effect<Target, RemoteFailure> =>
  Schema.decodeUnknownEffect(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })),
  );

const parseCommand = (
  commandArguments: readonly string[],
): Effect.Effect<
  {
    readonly operation: "bootstrap";
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
  return operation === "bootstrap" && (planned || executed)
    ? Effect.succeed({ confirmation, execute: executed, operation })
    : fail("REMOTE_COMMAND_INVALID");
};

export const parseRemoteInput = Effect.fn("parseRemoteInput")(function* parseRemoteInput(
  commandArguments: readonly string[],
  input: unknown,
) {
  const { confirmation, execute, operation } = yield* parseCommand(commandArguments);
  if (!execute) {
    return { execute: false, operation, target: yield* decodedTarget(PlanTarget, input) } as const;
  }
  const target = yield* decodedTarget(ExecuteTarget, input);
  if (confirmation !== target.databaseId) {
    return yield* fail("REMOTE_TARGET_MISMATCH");
  }
  return { execute: true, operation, target } as const;
});
