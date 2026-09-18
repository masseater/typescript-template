import { Effect, type LogLevel } from "effect";

import { annotateLogs, type Attributes } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";

type Severity = Extract<LogLevel.Severity, "Error" | "Info" | "Warn">;

const refusals: ReadonlySet<number> = new Set([
  httpStatus.unauthorized,
  httpStatus.forbidden,
  httpStatus.notFound,
]);
const firstStatus = 100;

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
  logged: { readonly eventName: string; readonly attributes: Attributes },
): Effect.Effect<void> =>
  Effect.logWithLevel(severity)(logged.eventName).pipe(annotateLogs(logged.attributes));

export { logAt, statusSeverity };
export type { Severity };
