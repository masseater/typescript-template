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
type SettledStatus =
  | typeof httpStatus.accepted
  | typeof httpStatus.found
  | typeof httpStatus.noContent
  | typeof httpStatus.ok;
type HttpStatus = (typeof httpStatus)[keyof typeof httpStatus];
type FailureStatus = Exclude<HttpStatus, SettledStatus>;
type Failure<Status extends FailureStatus = FailureStatus> = {
  readonly status: Status;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};
const mapped = Symbol("FailureMapping");
type FailureMapping<Caught> = {
  readonly [mapped]: true;
  readonly statuses: readonly FailureStatus[];
  readonly failureOf: {
    bivarianceHack(caughtError: Caught): Failure;
  }["bivarianceHack"];
};
type FailureEntry<Caught> =
  | Failure
  | "unexpected"
  | FailureMapping<Caught>
  | {
      bivarianceHack(caughtError: Caught): Failure;
    }["bivarianceHack"];
type FailureTable<Failures extends Tagged> = {
  readonly [Tag in Failures["_tag"]]: FailureEntry<Extract<Failures, { readonly _tag: Tag }>>;
};
type ExactFailureTable<_Failures extends Tagged, Table> = Table;
type AnyFailureEntry =
  | Failure
  | "unexpected"
  | FailureMapping<any>
  | ((caughtError: any) => Failure);
type AnyFailureTable = Readonly<Record<string, AnyFailureEntry>>;
type InputKind = "body" | "none" | "query";
type FailureBody = Readonly<Record<string, unknown>> & {
  readonly error: string;
};
const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";
const settledStatuses: ReadonlySet<HttpStatus> = new Set([
  httpStatus.accepted,
  httpStatus.found,
  httpStatus.noContent,
  httpStatus.ok,
]);
const failureStatuses = Object.values(httpStatus).filter(
  (code): code is FailureStatus => !settledStatuses.has(code),
);
const FailureShape = Schema.Struct({
  details: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  message: Schema.String,
  status: Schema.Literals(failureStatuses),
});
const TaggedShape = Schema.Struct({ _tag: Schema.String });
const isFailure = Schema.is(FailureShape);
const isTagged = Schema.is(TaggedShape);
const failureBy = <const Statuses extends readonly FailureStatus[], Caught>(
  statuses: Statuses,
  failureOf: (caughtError: Caught) => Failure<Statuses[number]>,
): FailureMapping<Caught> => {
  return { [mapped]: true, failureOf, statuses };
};
const queryFailures: FailureTable<InputInvalid> = {
  InputInvalid: { message: invalidInput, status: httpStatus.badRequest },
};
const rejectionStatuses = Object.values(rejectionStatus);
const bodyFailures: FailureTable<InputInvalid | RequestRejected> = {
  ...queryFailures,
  RequestRejected: failureBy<typeof rejectionStatuses, RequestRejected>(
    rejectionStatuses,
    (rejection) => ({
      message: rejection.reason === "invalid_json" ? invalidInput : forbidden,
      status: rejectionStatus[rejection.reason],
    }),
  ),
};
const inputFailures: Readonly<Record<InputKind, AnyFailureTable>> = {
  body: bodyFailures,
  none: {},
  query: queryFailures,
};
const entryStatuses = (mapEntry: AnyFailureEntry): readonly FailureStatus[] => {
  if (mapEntry === "unexpected") {
    return [httpStatus.internalServerError];
  }
  if (typeof mapEntry === "function") {
    return [];
  }
  return mapped in mapEntry ? mapEntry.statuses : [mapEntry.status];
};
const declaredStatuses = (table: AnyFailureTable): readonly FailureStatus[] => {
  const statuses = new Set([
    ...Object.values(table).flatMap(entryStatuses),
    httpStatus.internalServerError,
    httpStatus.serviceUnavailable,
  ]);
  return [...statuses].toSorted((left, right) => left - right);
};
const resolvedFailure = (resolved: unknown): Failure | undefined => {
  return isFailure(resolved) ? resolved : undefined;
};
const failureOf = (table: AnyFailureTable, caughtError: unknown): Failure | undefined => {
  if (!isTagged(caughtError) || !Object.hasOwn(table, caughtError._tag)) {
    return undefined;
  }
  const mapEntry = table[caughtError._tag];
  if (mapEntry === undefined || mapEntry === "unexpected") {
    return undefined;
  }
  if (typeof mapEntry === "function") {
    return resolvedFailure(Reflect.apply(mapEntry, undefined, [caughtError]));
  }
  if (mapped in mapEntry) {
    return resolvedFailure(Reflect.apply(mapEntry.failureOf, mapEntry, [caughtError]));
  }
  return mapEntry;
};
const reportedFailure = (
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Failure> => {
  const caughtError = Cause.findErrorOption(cause);
  const failure = Option.isSome(caughtError) ? failureOf(table, caughtError.value) : undefined;
  if (failure !== undefined) {
    return Effect.succeed(failure);
  }
  const unexpected = { message: unexpectedMessage, status: httpStatus.internalServerError };
  return reportFailure(cause).pipe(Effect.as(unexpected));
};
const failureBody = (failure: Failure): FailureBody => {
  return { ...failure.details, error: failure.message };
};
const failureResponse = (
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> => {
  return reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse(failureBody(failure), failure.status)),
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
export {
  declaredStatuses,
  failureBody,
  failureBy,
  failureResponse,
  inputFailures,
  reportedFailure,
  runtimeUnavailable,
};
export type {
  AnyFailureEntry,
  AnyFailureTable,
  ExactFailureTable,
  Failure,
  FailureBody,
  FailureEntry,
  FailureMapping,
  FailureStatus,
  FailureTable,
  HttpStatus,
  InputKind,
  SettledStatus,
  Tagged,
};
