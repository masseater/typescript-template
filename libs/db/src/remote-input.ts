import * as v from "valibot";

const targetSchema = v.strictObject({
  accountId: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
  databaseId: v.pipe(
    v.string(),
    v.uuid(),
    v.check((value) => !value.startsWith("00000000-")),
  ),
  apiToken: v.optional(v.pipe(v.string(), v.minLength(20), v.regex(/^[A-Za-z0-9_-]+$/))),
  email: v.optional(v.pipe(v.string(), v.email())),
});

export function parseRemoteInput(args: readonly string[], input: unknown) {
  const [operation, mode, confirmationFlag, confirmation] = args;
  if (
    (operation !== "migrate" && operation !== "bootstrap") ||
    !(
      (mode === "--plan" && args.length === 2) ||
      (mode === "--execute" && args.length === 4 && confirmationFlag === "--confirm-database")
    )
  )
    throw new Error("REMOTE_COMMAND_INVALID");
  const result = v.safeParse(targetSchema, input);
  if (!result.success) throw new Error("REMOTE_INPUT_INVALID");
  const target = result.output;
  if (
    (operation === "bootstrap" && !target.email) ||
    (operation === "migrate" && target.email) ||
    (mode === "--execute" && !target.apiToken)
  )
    throw new Error("REMOTE_INPUT_INVALID");
  if (mode === "--execute" && confirmation !== target.databaseId)
    throw new Error("REMOTE_TARGET_MISMATCH");
  return { operation, execute: mode === "--execute", target };
}

const safeErrors = new Set([
  "REMOTE_COMMAND_INVALID",
  "REMOTE_INPUT_INVALID",
  "REMOTE_TARGET_MISMATCH",
  "REMOTE_QUERY_FAILED",
  "REMOTE_RESPONSE_INVALID",
  "REMOTE_MIGRATIONS_INVALID",
  "REMOTE_MIGRATION_HISTORY_MISMATCH",
  "REMOTE_MIGRATIONS_REQUIRED",
  "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
  "BOOTSTRAP_EMAIL_INVALID",
]);

export function remoteErrorCode(error: unknown): string {
  return error instanceof Error && safeErrors.has(error.message)
    ? error.message
    : "REMOTE_DATABASE_FAILED";
}
