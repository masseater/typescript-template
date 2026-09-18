import { Effect } from "effect";

import { annotateLogs } from "./annotations.ts";
import type { Attributes } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";

type Severity = "error" | "info" | "warning";

const refusals: ReadonlySet<number> = new Set([
  httpStatus.unauthorized,
  httpStatus.forbidden,
  httpStatus.notFound,
]);

function statusSeverity(status: number | undefined): Severity {
  if (status === undefined || status >= httpStatus.internalServerError) {
    return "error";
  }
  if (status < httpStatus.badRequest) {
    return "info";
  }
  return refusals.has(status) ? "info" : "warning";
}

function logAt(severity: Severity, event: string, attributes: Attributes): Effect.Effect<void> {
  if (severity === "error") {
    return Effect.logError(event).pipe(annotateLogs(attributes));
  }
  return (severity === "warning" ? Effect.logWarning(event) : Effect.logInfo(event)).pipe(
    annotateLogs(attributes),
  );
}

export { logAt, statusSeverity };
export type { Severity };
