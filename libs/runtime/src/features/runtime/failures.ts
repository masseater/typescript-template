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
type Failure<Status extends FailureStatus = FailureStatus> = {
  readonly status: Status;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};
const mappingMarker = Symbol("FailureMapping");
type FailureMapping<CaughtError> = {
  readonly [mappingMarker]: true;
  readonly statuses: readonly FailureStatus[];
  readonly failureOf: { bivarianceHack(caughtError: CaughtError): Failure }["bivarianceHack"];
};
type FailureTable<Failures extends Tagged> = {
  readonly [Tag in Failures["_tag"]]:
    | Failure
    | "unexpected"
    | FailureMapping<Extract<Failures, { readonly _tag: Tag }>>
    | {
        bivarianceHack(caughtError: Extract<Failures, { readonly _tag: Tag }>): Failure;
      }["bivarianceHack"];
};
type InputFailure = InputInvalid | RequestRejected;
type AnyFailureEntry =
  | Failure
  | "unexpected"
  | FailureMapping<never>
  | ((caughtError: never) => Failure);
type AnyFailureTable = Readonly<Record<string, AnyFailureEntry>>;
type ExactFailureTable<Failures extends Tagged> = FailureTable<Exclude<Failures, InputFailure>> &
  AnyFailureTable;

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

const failureBy = <const Statuses extends readonly FailureStatus[], CaughtError>(
  answerStatuses: Statuses,
  failureOf: (caughtError: CaughtError) => Failure<Statuses[number]>,
): FailureMapping<CaughtError> => ({
  [mappingMarker]: true,
  failureOf,
  statuses: answerStatuses,
});

const queryFailures: FailureTable<InputInvalid> = {
  InputInvalid: { message: invalidInput, status: httpStatus.badRequest },
};

const bodyFailures: FailureTable<InputFailure> = {
  ...queryFailures,
  RequestRejected: failureBy(
    Object.values(rejectionStatus),
    ({ reason }: Readonly<{ reason: RequestRejected["reason"] }>) => ({
      message: reason === "invalid_json" ? invalidInput : forbidden,
      status: rejectionStatus[reason],
    }),
  ),
};

const inputFailures = {
  body: bodyFailures,
  none: {},
  query: queryFailures,
} as const satisfies Readonly<Record<string, AnyFailureTable>>;
type InputKind = keyof typeof inputFailures;

const answerStatusesOf = (tableEntry: AnyFailureEntry): readonly FailureStatus[] => {
  if (tableEntry === "unexpected") {
    return [httpStatus.internalServerError];
  }
  if (typeof tableEntry === "function") {
    return [];
  }
  return mappingMarker in tableEntry ? tableEntry.statuses : [tableEntry.status];
};

const declaredStatuses = (table: AnyFailureTable): readonly FailureStatus[] => {
  const answerStatuses = new Set([
    ...Object.values(table).flatMap(answerStatusesOf),
    httpStatus.internalServerError,
    httpStatus.serviceUnavailable,
  ]);
  return [...answerStatuses].toSorted((left, right) => left - right);
};

const resolvedFailure = (
  tableEntry: FailureMapping<never> | ((caughtError: never) => Failure),
  caughtError: Tagged,
): Failure | undefined => {
  const resolved: unknown =
    typeof tableEntry === "function"
      ? Reflect.apply(tableEntry, undefined, [caughtError])
      : Reflect.apply(tableEntry.failureOf, undefined, [caughtError]);
  return isFailure(resolved) ? resolved : undefined;
};

const toFailure = (table: AnyFailureTable, caughtError: unknown): Failure | undefined => {
  if (!isTagged(caughtError) || !Object.hasOwn(table, caughtError._tag)) {
    return undefined;
  }
  const tableEntry = table[caughtError._tag];
  if (tableEntry === undefined || tableEntry === "unexpected") {
    return undefined;
  }
  if (typeof tableEntry === "function" || mappingMarker in tableEntry) {
    return resolvedFailure(tableEntry, caughtError);
  }
  return tableEntry;
};

const reportedFailure = (
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Failure> => {
  const caughtError = Cause.findErrorOption(cause);
  const failure = Option.isSome(caughtError) ? toFailure(table, caughtError.value) : undefined;
  if (failure !== undefined) {
    return Effect.succeed(failure);
  }
  const unexpected = { message: unexpectedMessage, status: httpStatus.internalServerError };
  return reportFailure(cause).pipe(Effect.as(unexpected));
};
type FailureBody = NonNullable<Failure["details"]> & { readonly error: string };
const failureBody = (failure: Failure): FailureBody => ({
  ...failure.details,
  error: failure.message,
});
const failureResponse = (
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> =>
  reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse(failureBody(failure), failure.status)),
  );
const runtimeUnavailable = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Failure> =>
  reportUnavailable(cause, reporting).pipe(
    Effect.as({ message: unexpectedMessage, status: httpStatus.serviceUnavailable }),
  );

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
  FailureMapping,
  FailureStatus,
  FailureTable,
  HttpStatus,
  InputFailure,
  InputKind,
  Tagged,
};
