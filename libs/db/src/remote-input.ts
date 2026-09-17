import {
  check,
  email,
  minLength,
  optional,
  pipe,
  regex,
  safeParse,
  strictObject,
  string,
  uuid,
} from "valibot";
import type { InferOutput } from "valibot";

const API_TOKEN_MIN_LENGTH = 20;
const PLAN_ARGUMENT_COUNT = 2;
const EXECUTE_ARGUMENT_COUNT = 4;

const accountIdSchema = pipe(string(), regex(/^[a-f0-9]{32}$/u));
const apiTokenSchema = pipe(string(), minLength(API_TOKEN_MIN_LENGTH), regex(/^[\w-]+$/u));
const databaseIdSchema = pipe(
  string(),
  uuid(),
  check((value) => !value.startsWith("00000000-")),
);
const emailSchema = pipe(string(), email());
const targetSchema = strictObject({
  accountId: accountIdSchema,
  apiToken: optional(apiTokenSchema),
  databaseId: databaseIdSchema,
  email: optional(emailSchema),
});

type RemoteOperation = "migrate" | "bootstrap";
type RemoteTarget = InferOutput<typeof targetSchema>;
type RemoteInput = Readonly<{ execute: boolean; operation: RemoteOperation; target: RemoteTarget }>;

function isRemoteOperation(operation: string | undefined): operation is RemoteOperation {
  return operation === "migrate" || operation === "bootstrap";
}

function isValidMode(args: readonly string[]): boolean {
  const [, mode, confirmationFlag] = args;
  return (
    (mode === "--plan" && args.length === PLAN_ARGUMENT_COUNT) ||
    (mode === "--execute" &&
      args.length === EXECUTE_ARGUMENT_COUNT &&
      confirmationFlag === "--confirm-database")
  );
}

function hasRequiredFields(
  operation: RemoteOperation,
  execute: boolean,
  target: Readonly<RemoteTarget>,
): boolean {
  const hasEmail = target.email !== undefined;
  return (operation === "bootstrap") === hasEmail && (!execute || target.apiToken !== undefined);
}

function parseTarget(input: unknown): RemoteTarget {
  const result = safeParse(targetSchema, input);
  if (!result.success) {
    throw new Error("REMOTE_INPUT_INVALID");
  }
  return result.output;
}

function parseRemoteInput(args: readonly string[], input: unknown): RemoteInput {
  const [operation, mode, , confirmation] = args;
  if (!isRemoteOperation(operation) || !isValidMode(args)) {
    throw new Error("REMOTE_COMMAND_INVALID");
  }
  const target = parseTarget(input);
  const execute = mode === "--execute";
  if (!hasRequiredFields(operation, execute, target)) {
    throw new Error("REMOTE_INPUT_INVALID");
  }
  if (execute && confirmation !== target.databaseId) {
    throw new Error("REMOTE_TARGET_MISMATCH");
  }
  return { execute, operation, target };
}

export { parseRemoteInput };
export type { RemoteTarget };
