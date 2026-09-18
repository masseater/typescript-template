import { Effect } from "effect";
import type { LogLevel } from "effect";

import { annotateLogs } from "./annotations.ts";
import type { Attributes } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";

type Severity = Extract<LogLevel.Severity, "Error" | "Info" | "Warn">;

const refusals: ReadonlySet<number> = new Set([
  httpStatus.unauthorized,
  httpStatus.forbidden,
  httpStatus.notFound,
]);
const firstStatus = 100;

function statusSeverity(status: number | undefined): Severity {
  if (status === undefined || status < firstStatus || status >= httpStatus.internalServerError) {
    return "Error";
  }
  if (status < httpStatus.badRequest) {
    return "Info";
  }
  return refusals.has(status) ? "Info" : "Warn";
}

function logAt(severity: Severity, event: string, attributes: Attributes): Effect.Effect<void> {
  return Effect.logWithLevel(severity)(event).pipe(annotateLogs(attributes));
}

export { logAt, statusSeverity };
export type { Severity };
