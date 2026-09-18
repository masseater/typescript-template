import { Cause, Effect, Option, Result, Schema } from "effect";
import type { LogSink, RequestRejected } from "@template/observability";
import {
  consoleSink,
  failureAttributes,
  httpStatus,
  redactSecrets,
  rejectionStatus,
  reportFailure,
} from "@template/observability";
import type { InputInvalid } from "./input-invalid.ts";
import { jsonResponse } from "./responses.ts";

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
interface Failure {
  readonly status: FailureStatus;
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

const summaryLength = 512;
const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";
const FailureShape = Schema.Struct({
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

function failureResponse(
  table: object,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> {
  return reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse({ error: failure.message }, failure.status)),
  );
}

function bounded(value: string): string {
  return redactSecrets(value).slice(0, summaryLength);
}

function serializableField(key: string, value: unknown): unknown {
  if (key === "_tag") {
    return undefined;
  }
  return key !== "" && value instanceof Error
    ? { message: value.message, name: value.name }
    : value;
}

function errorFields(error: unknown): string {
  const encoded = Result.try(() => JSON.stringify(error, serializableField));
  return Result.isSuccess(encoded) ? bounded(encoded.success) : "";
}

function unavailableLog(cause: Readonly<Cause.Cause<unknown>>): Record<string, string> {
  const error = Cause.squash(cause);
  return {
    ...failureAttributes(cause),
    "error.cause": bounded(Cause.pretty(cause)),
    "error.fields": errorFields(error),
    "error.message": bounded(error instanceof Error ? error.message : String(error)),
    event: "application.runtime_unavailable",
  };
}

function runtimeUnavailable(
  cause: Readonly<Cause.Cause<unknown>>,
  log: LogSink = consoleSink,
): Failure {
  log.error(JSON.stringify(unavailableLog(cause)));
  return { message: unexpectedMessage, status: httpStatus.serviceUnavailable };
}

export { failureResponse, reportedFailure, runtimeUnavailable };
export type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged };
