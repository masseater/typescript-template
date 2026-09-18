import { Schema } from "effect";
import type { SchemaIssue } from "effect";

type Validator = Parameters<typeof Schema.toStandardSchemaV1>[0];

interface TextFieldApi {
  readonly handleChange: (value: string) => void;
  readonly state: Readonly<{
    meta: Readonly<{ errors: readonly unknown[] }>;
    value: string;
  }>;
}

const formColumnClassName = "flex w-full max-w-column flex-col gap-4";

const leafMessages: Readonly<Record<SchemaIssue.Leaf["_tag"], string>> = {
  Forbidden: "入力内容を確認してください。",
  InvalidType: "入力してください。",
  InvalidValue: "正しい値を入力してください。",
  MissingKey: "入力してください。",
  OneOf: "入力内容を確認してください。",
  UnexpectedKey: "入力内容を確認してください。",
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function leafHook(issue: SchemaIssue.Leaf): string {
  return leafMessages[issue._tag];
}

function formValidator<Contract extends Validator>(
  schema: Contract,
): ReturnType<typeof Schema.toStandardSchemaV1<Contract>> {
  return Schema.toStandardSchemaV1(schema, { leafHook });
}

function fieldError(errors: readonly unknown[]): string | undefined {
  const [issue] = errors;
  return issue !== null && typeof issue === "object" && "message" in issue
    ? String(issue.message)
    : undefined;
}

export { fieldError, formColumnClassName, formValidator };
export type { TextFieldApi };
