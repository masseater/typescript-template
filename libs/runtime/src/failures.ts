import { httpStatus } from "@repo/config";
import { rejectionStatus, reportFailure, reportUnavailable } from "@repo/observability";
import { Cause, Effect, Option, Schema } from "effect";

import { jsonResponse } from "./responses.ts";

import type { Reporting, RequestRejected } from "@repo/observability";
import type { InputInvalid } from "./input-invalid.ts";

interface Tagged {
  readonly _tag: string;
}
type SettledStatus =
  | typeof httpStatus.accepted
  | typeof httpStatus.found
  | typeof httpStatus.noContent
  | typeof httpStatus.ok;
type HttpStatus = (typeof httpStatus)[keyof typeof httpStatus];
type FailureStatus = Exclude<HttpStatus, SettledStatus>;
const settledStatuses: ReadonlySet<HttpStatus> = new Set([
  httpStatus.accepted,
  httpStatus.found,
  httpStatus.noContent,
  httpStatus.ok,
]);
const failureStatuses = Object.values(httpStatus).filter(
  (code): code is FailureStatus => !settledStatuses.has(code),
);
type FailureDetails = Readonly<Record<string, unknown>>;
interface Failure {
  readonly status: FailureStatus;
  readonly message: string;
  readonly details?: FailureDetails;
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
const FailureShape = Schema.Struct({
  details: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  message: Schema.String,
  status: Schema.Literals(failureStatuses),
});
const TaggedShape = Schema.Struct({ _tag: Schema.String });
const isFailure = Schema.is(FailureShape);
const isTagged = Schema.is(TaggedShape);

const commonFailures: FailureTable<CommonFailure> = {
  AdminMfaRequired: { message: forbidden, status: httpStatus.forbidden },
  AdminRequired: { message: forbidden, status: httpStatus.forbidden },
  InputInvalid: { message: invalidInput, status: httpStatus.badRequest },
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

function reportedFailure(
  table: object,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Failure> {
  const error = Cause.findErrorOption(cause);
  const failure = Option.isSome(error)
    ? toFailure({ ...commonFailures, ...table }, error.value)
    : undefined;
  if (failure !== undefined) {
    return Effect.succeed(failure);
  }
  const unexpected = { message: unexpectedMessage, status: httpStatus.internalServerError };
  return reportFailure(cause).pipe(Effect.as(unexpected));
}

type FailureBody = FailureDetails & { readonly error: string };

function failureBody(failure: Failure): FailureBody {
  return { ...failure.details, error: failure.message };
}

function failureResponse(
  table: object,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> {
  return reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse(failureBody(failure), failure.status)),
  );
}

function runtimeUnavailable(
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Failure> {
  return reportUnavailable(cause, reporting).pipe(
    Effect.as({ message: unexpectedMessage, status: httpStatus.serviceUnavailable }),
  );
}

export { failureBody, failureResponse, reportedFailure, runtimeUnavailable };
export type { CommonFailure, Failure, FailureBody, FailureStatus, FailureTable, Tagged };
