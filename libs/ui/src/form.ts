import { Schema } from "effect";
import type { SchemaIssue } from "effect";

type Validator = Parameters<typeof Schema.toStandardSchemaV1>[0];

interface TextFieldApi {
  readonly handleChange: (value: string) => void;
  readonly state: Readonly<{
    meta: Readonly<{ errors: readonly (Readonly<{ message: string }> | undefined)[] }>;
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

function formValidator<Contract extends Validator>(
  schema: Contract,
): ReturnType<typeof Schema.toStandardSchemaV1<Contract>> {
  return Schema.toStandardSchemaV1(schema, { leafHook: (issue) => leafMessages[issue._tag] });
}

function fieldError(errors: TextFieldApi["state"]["meta"]["errors"]): string | undefined {
  const [issue] = errors;
  return issue?.message;
}

export { fieldError, formColumnClassName, formValidator };
export type { TextFieldApi };
