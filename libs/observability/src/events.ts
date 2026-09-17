import { validRequestId, validSpanId, validTraceId } from "./protocol.ts";
import type { Correlation } from "./protocol.ts";

export type BrowserEvent = Correlation & {
  kind: "http" | "exception" | "vital";
  route: string;
  start: number;
  duration: number;
  status: number;
  method: string;
  name:
    | "http.client.request"
    | "browser.error"
    | "browser.unhandledrejection"
    | "CLS"
    | "INP"
    | "LCP"
    | "FCP"
    | "TTFB";
  value: number;
};

const keys: ReadonlyArray<keyof BrowserEvent> = [
  "kind",
  "route",
  "start",
  "duration",
  "status",
  "method",
  "name",
  "value",
  "traceId",
  "spanId",
  "requestId",
];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;

export function parseBrowserEvents(
  input: unknown,
  labels: ReadonlySet<string>,
  now: number,
): BrowserEvent[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 32)
    throw new Error("Invalid telemetry batch");
  return input.map((item: unknown): BrowserEvent => {
    if (
      !record(item) ||
      Object.keys(item).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(item, key))
    )
      throw new Error("Invalid telemetry fields");
    const {
      kind,
      route,
      start,
      duration,
      status,
      method,
      name,
      value,
      traceId,
      spanId,
      requestId,
    } = item;
    if (
      typeof route !== "string" ||
      !labels.has(route) ||
      !finite(start, now + 60_000) ||
      start < now - 3_600_000 ||
      !finite(duration, 600_000) ||
      !finite(value, 600_000) ||
      !finite(status, 599) ||
      !Number.isInteger(status) ||
      !validTraceId(traceId) ||
      !validSpanId(spanId) ||
      !validRequestId(requestId)
    )
      throw new Error("Invalid telemetry value");
    if (
      typeof method !== "string" ||
      !["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "_OTHER"].includes(method)
    )
      throw new Error("Invalid telemetry method");
    if (kind === "http" && name === "http.client.request" && (status === 0 || status >= 100))
      return {
        kind,
        route,
        start,
        duration,
        status,
        method,
        name,
        value,
        traceId,
        spanId,
        requestId,
      };
    if (
      kind === "exception" &&
      (name === "browser.error" || name === "browser.unhandledrejection") &&
      status === 0
    )
      return {
        kind,
        route,
        start,
        duration,
        status,
        method,
        name,
        value,
        traceId,
        spanId,
        requestId,
      };
    if (
      kind === "vital" &&
      (name === "CLS" || name === "INP" || name === "LCP" || name === "FCP" || name === "TTFB") &&
      status === 0
    )
      return {
        kind,
        route,
        start,
        duration,
        status,
        method,
        name,
        value,
        traceId,
        spanId,
        requestId,
      };
    throw new Error("Invalid telemetry event");
  });
}
