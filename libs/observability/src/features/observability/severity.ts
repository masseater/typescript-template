import { httpStatus } from "@repo/config";
import { Effect, type Cause, type LogLevel } from "effect";

import { annotateLogs, type Attributes } from "./annotations.ts";
const refusals: ReadonlySet<number> = new Set([
  httpStatus.unauthorized,
  httpStatus.forbidden,
  httpStatus.notFound,
  httpStatus.preconditionRequired,
]);
const firstStatus = 100;
type Severity = Extract<LogLevel.Severity, "Error" | "Info" | "Warn">;
const statusSeverity = (responseStatus: number | undefined): Severity => {
  if (
    responseStatus === undefined ||
    responseStatus < firstStatus ||
    responseStatus >= httpStatus.internalServerError
  ) {
    return "Error";
  }
  if (responseStatus < httpStatus.badRequest) {
    return "Info";
  }
  return refusals.has(responseStatus) ? "Info" : "Warn";
};
const logAt = (
  severity: Severity,
  logged: {
    readonly eventName: string;
    readonly attributes?: Attributes;
    readonly cause?: Readonly<Cause.Cause<unknown>>;
  },
): Effect.Effect<void> =>
  (logged.cause === undefined
    ? Effect.logWithLevel(severity)(logged.eventName)
    : Effect.logWithLevel(severity)(logged.eventName, logged.cause)
  ).pipe(annotateLogs(logged.attributes ?? {}));
const logCause = (logged: {
  readonly eventName: string;
  readonly cause: Readonly<Cause.Cause<unknown>>;
  readonly attributes?: Attributes;
}): Effect.Effect<void> => logAt("Error", logged);
export { logAt, logCause, statusSeverity };
export type { Severity };
