import { errorTypes, validErrorLocations } from "./errors.ts";
import type { ErrorType } from "./errors.ts";
import { validRequestId, validSpanId, validTraceId } from "./protocol.ts";
import type { Correlation } from "./protocol.ts";

type EventFields = Correlation & {
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
type HttpEvent = EventFields & { kind: "http" };
type VitalEvent = EventFields & { kind: "vital" };
type ExceptionEvent = EventFields & { kind: "exception"; errorType: ErrorType; locations: string };
export type BrowserEvent = HttpEvent | VitalEvent | ExceptionEvent;

const keys: ReadonlyArray<keyof EventFields | "kind"> = [
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
const exceptionKeys = [...keys, "errorType", "locations"];
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
    const expected = record(item) && item["kind"] === "exception" ? exceptionKeys : keys;
    if (
      !record(item) ||
      Object.keys(item).length !== expected.length ||
      expected.some((key) => !Object.hasOwn(item, key))
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
    const errorType = errorTypes.find((candidate) => candidate === item["errorType"]);
    const { locations } = item;
    if (
      kind === "exception" &&
      (name === "browser.error" || name === "browser.unhandledrejection") &&
      status === 0 &&
      errorType &&
      validErrorLocations(locations)
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
        errorType,
        locations,
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
