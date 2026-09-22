import { httpStatus } from "@repo/config";
import {
  rejectionStatus,
  reportFailure,
  reportUnavailable,
  type Reporting,
  type RequestRejected,
} from "@repo/observability";
import { Cause, Effect, Option, Schema } from "effect";

import { jsonResponse } from "./responses.ts";

import type { InputInvalid } from "./input-invalid.ts";
type Tagged = {
  readonly _tag: string;
};
type HttpStatus = (typeof httpStatus)[keyof typeof httpStatus];
type FailureStatus = Exclude<
  HttpStatus,
  | typeof httpStatus.accepted
  | typeof httpStatus.found
  | typeof httpStatus.noContent
  | typeof httpStatus.ok
>;
const settledStatuses: ReadonlySet<HttpStatus> = new Set([
  httpStatus.accepted,
  httpStatus.found,
  httpStatus.noContent,
  httpStatus.ok,
]);
const failureStatuses = Object.values(httpStatus).filter(
  (code): code is FailureStatus => !settledStatuses.has(code),
);
type Failure = {
  readonly status: FailureStatus;
  readonly message: string;
};
type FailureTable<Failures extends Tagged> = {
  readonly [Tag in Failures["_tag"]]:
    | Failure
    | "unexpected"
    | {
        bivarianceHack(caughtError: Extract<Failures, { readonly _tag: Tag }>): Failure;
      }["bivarianceHack"];
};
type CommonFailure =
  | RequestRejected
  | InputInvalid
  | {
      readonly _tag: "SessionRequired";
    }
  | {
      readonly _tag: "SessionInvalid";
    }
  | {
      readonly _tag: "AdminRequired";
    }
  | {
      readonly _tag: "AdminMfaRequired";
    };
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
  RequestRejected: (caughtError) => ({
    message: caughtError.reason === "invalid_json" ? invalidInput : forbidden,
    status: rejectionStatus[caughtError.reason],
  }),
  SessionInvalid: { message: forbidden, status: httpStatus.forbidden },
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
};
const toFailure = (table: object, caughtError: unknown): Failure | undefined => {
  if (!isTagged(caughtError)) {
    return undefined;
  }
  const mapEntry: unknown = Reflect.get(table, caughtError._tag);
  const failure: unknown =
    typeof mapEntry === "function" ? Reflect.apply(mapEntry, undefined, [caughtError]) : mapEntry;
  return isFailure(failure) ? failure : undefined;
};
const reportedFailure = (
  table: object,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Failure> => {
  const caughtError = Cause.findErrorOption(cause);
  const failure = Option.isSome(caughtError)
    ? toFailure({ ...commonFailures, ...table }, caughtError.value)
    : undefined;
  if (failure !== undefined) {
    return Effect.succeed(failure);
  }
  const unexpected = { message: unexpectedMessage, status: httpStatus.internalServerError };
  return reportFailure(cause).pipe(Effect.as(unexpected));
};
const failureResponse = (
  table: object,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> => {
  return reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse({ error: failure.message }, failure.status)),
  );
};
const runtimeUnavailable = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Failure> => {
  return reportUnavailable(cause, reporting).pipe(
    Effect.as({ message: unexpectedMessage, status: httpStatus.serviceUnavailable }),
  );
};
export { failureResponse, reportedFailure, runtimeUnavailable };
export type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged };
