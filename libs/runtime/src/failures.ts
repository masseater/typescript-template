import { Cause, Effect, Option, Schema } from "effect";
import { httpStatus, rejectionStatus, reportFailure } from "@template/observability";
import type { InputInvalid } from "./input-invalid.ts";
import type { RequestRejected } from "@template/observability";
import { jsonResponse } from "./responses.ts";

interface Tagged {
  readonly _tag: string;
}
interface Failure {
  readonly status: number;
  readonly message: string;
}
type FailureTable<Failures extends Tagged> = {
  readonly [Tag in Failures["_tag"]]:
    | Failure
    | "unexpected"
    | ((error: Extract<Failures, { readonly _tag: Tag }>) => Failure);
};
type CommonFailure =
  | RequestRejected
  | InputInvalid
  | { readonly _tag: "SessionRequired" }
  | { readonly _tag: "SessionInvalid" }
  | { readonly _tag: "AdminRequired" }
  | { readonly _tag: "AdminMfaRequired" };

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";
const FailureShape = Schema.Struct({ message: Schema.String, status: Schema.Int });
const TaggedShape = Schema.Struct({ _tag: Schema.String });
const isFailure = Schema.is(FailureShape);
const isTagged = Schema.is(TaggedShape);

const commonFailures: FailureTable<CommonFailure> = {
  AdminMfaRequired: { message: forbidden, status: httpStatus.forbidden },
  AdminRequired: { message: forbidden, status: httpStatus.forbidden },
  InputInvalid: { message: invalidInput, status: httpStatus.badRequest },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  RequestRejected: (error) => ({
    message: error.reason === "invalid_json" ? invalidInput : forbidden,
    status: rejectionStatus[error.reason],
  }),
  SessionInvalid: { message: forbidden, status: httpStatus.forbidden },
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
};

function toFailure(table: object, error: unknown): Failure | undefined {
  if (!isTagged(error)) {
    return undefined;
  }
  const entry: unknown = Reflect.get(table, error._tag);
  const failure: unknown =
    typeof entry === "function" ? Reflect.apply(entry, undefined, [error]) : entry;
  return isFailure(failure) ? failure : undefined;
}

function failureResponse(
  table: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> {
  const error = Cause.findErrorOption(cause);
  const failure = Option.isSome(error)
    ? toFailure({ ...commonFailures, ...table }, error.value)
    : undefined;
  if (failure !== undefined) {
    return Effect.succeed(jsonResponse({ error: failure.message }, failure.status));
  }
  const unexpected = jsonResponse({ error: unexpectedMessage }, httpStatus.internalServerError);
  return reportFailure(cause).pipe(Effect.as(unexpected));
}

export { failureResponse };
export type { CommonFailure, Failure, FailureTable, Tagged };
