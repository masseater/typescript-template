import { httpStatus, rejectionStatus, reportFailure, reportUnavailable } from "@repo/observability";
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
interface Failure<Status extends FailureStatus = FailureStatus> {
  readonly status: Status;
  readonly message: string;
}
const mapped = Symbol("FailureMapping");
interface FailureMapping<Error> {
  readonly [mapped]: true;
  readonly statuses: readonly FailureStatus[];
  failureOf(error: Error): Failure;
}
type FailureEntry<Error> = Failure | "unexpected" | FailureMapping<Error>;
type FailureTable<Failures extends Tagged> = {
  readonly [Tag in Failures["_tag"]]: FailureEntry<Extract<Failures, { readonly _tag: Tag }>>;
};
type ExactFailureTable<Failures extends Tagged, Table> = Table &
  FailureTable<NoInfer<Failures>> &
  Readonly<Record<Exclude<keyof Table, NoInfer<Failures>["_tag"]>, never>>;
type AnyFailureTable = Readonly<Record<string, FailureEntry<never>>>;
type InputKind = "body" | "none" | "query";

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
  message: Schema.String,
  status: Schema.Literals(failureStatuses),
});
const TaggedShape = Schema.Struct({ _tag: Schema.String });
const isFailure = Schema.is(FailureShape);
const isTagged = Schema.is(TaggedShape);

function failureBy<const Statuses extends readonly FailureStatus[], Error>(
  statuses: Statuses,
  failureOf: (error: Error) => Failure<Statuses[number]>,
): FailureMapping<Error> {
  return { [mapped]: true, failureOf, statuses };
}

const queryFailures: FailureTable<InputInvalid> = {
  InputInvalid: { message: invalidInput, status: httpStatus.badRequest },
};

const bodyFailures: FailureTable<InputInvalid | RequestRejected> = {
  ...queryFailures,
  RequestRejected: failureBy(
    Object.values(rejectionStatus),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (rejection: RequestRejected) => ({
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

function entryStatuses(entry: FailureEntry<never>): readonly FailureStatus[] {
  if (entry === "unexpected") {
    return [httpStatus.internalServerError];
  }
  return mapped in entry ? entry.statuses : [entry.status];
}

function declaredStatuses(table: AnyFailureTable): readonly FailureStatus[] {
  const statuses = new Set([
    ...Object.values(table).flatMap(entryStatuses),
    httpStatus.internalServerError,
    httpStatus.serviceUnavailable,
  ]);
  return [...statuses].toSorted((left, right) => left - right);
}

function failureOf(table: AnyFailureTable, error: unknown): Failure | undefined {
  if (!isTagged(error) || !Object.hasOwn(table, error._tag)) {
    return undefined;
  }
  const entry = table[error._tag];
  if (entry === undefined || entry === "unexpected") {
    return undefined;
  }
  if (mapped in entry) {
    const resolved: unknown = Reflect.apply(entry.failureOf, entry, [error]);
    return isFailure(resolved) ? resolved : undefined;
  }
  return entry;
}

function reportedFailure(
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Failure> {
  const error = Cause.findErrorOption(cause);
  const failure = Option.isSome(error) ? failureOf(table, error.value) : undefined;
  if (failure !== undefined) {
    return Effect.succeed(failure);
  }
  const unexpected = { message: unexpectedMessage, status: httpStatus.internalServerError };
  return reportFailure(cause).pipe(Effect.as(unexpected));
}

function failureResponse(
  table: AnyFailureTable,
  cause: Readonly<Cause.Cause<unknown>>,
): Effect.Effect<Response> {
  return reportedFailure(table, cause).pipe(
    Effect.map((failure) => jsonResponse({ error: failure.message }, failure.status)),
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

export {
  declaredStatuses,
  failureBy,
  failureResponse,
  inputFailures,
  reportedFailure,
  runtimeUnavailable,
};
export type {
  AnyFailureTable,
  ExactFailureTable,
  Failure,
  FailureStatus,
  FailureTable,
  InputKind,
  Tagged,
};
