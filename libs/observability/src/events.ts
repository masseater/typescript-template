import { errorType, validErrorLocations } from "./errors.ts";
import { validRequestId, validSpanId, validTraceId } from "./protocol.ts";
import type { Correlation } from "./protocol.ts";
import type { ErrorType } from "./errors.ts";

interface EventFields extends Correlation {
  readonly route: string;
  readonly start: number;
  readonly duration: number;
  readonly status: number;
  readonly method: string;
  readonly name:
    | "http.client.request"
    | "browser.error"
    | "browser.unhandledrejection"
    | "CLS"
    | "INP"
    | "LCP"
    | "FCP"
    | "TTFB";
  readonly value: number;
}
interface HttpEvent extends EventFields {
  readonly kind: "http";
}
interface VitalEvent extends EventFields {
  readonly kind: "vital";
}
interface ExceptionEvent extends EventFields {
  readonly kind: "exception";
  readonly errorType: ErrorType;
  readonly locations: string;
}
type BrowserEvent = HttpEvent | ExceptionEvent | VitalEvent;
type UntrustedFields = Readonly<Record<string, unknown>>;

const keys: readonly string[] = [
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
const exceptionKeys: readonly string[] = [...keys, "errorType", "locations"];
const methods: ReadonlySet<unknown> = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "_OTHER",
]);
const exceptionNames: ReadonlySet<unknown> = new Set([
  "browser.error",
  "browser.unhandledrejection",
]);
const vitalNames: ReadonlySet<unknown> = new Set(["CLS", "INP", "LCP", "FCP", "TTFB"]);
const maximumBatchSize = 32;
const maximumMeasurement = 600_000;
const maximumClockSkew = 60_000;
const maximumEventAge = 3_600_000;
const maximumStatus = 599;
const minimumHttpStatus = 100;

function isRecord(value: unknown): value is UntrustedFields {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

function hasExactKeys(item: UntrustedFields): boolean {
  const expected = item["kind"] === "exception" ? exceptionKeys : keys;
  return (
    Object.keys(item).length === expected.length &&
    expected.every((key) => Object.hasOwn(item, key))
  );
}

function validMeasurements(
  item: UntrustedFields,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): boolean {
  const { duration, route, start, status, value } = item;
  return (
    typeof route === "string" &&
    labels.has(route) &&
    finite(start, now + maximumClockSkew) &&
    start >= now - maximumEventAge &&
    finite(duration, maximumMeasurement) &&
    finite(value, maximumMeasurement) &&
    finite(status, maximumStatus) &&
    Number.isInteger(status)
  );
}

function validIdentifiers(item: UntrustedFields): boolean {
  const { requestId, spanId, traceId } = item;
  return validTraceId(traceId) && validSpanId(spanId) && validRequestId(requestId);
}

function validKind(item: UntrustedFields): boolean {
  const { kind, name, status } = item;
  if (kind === "http") {
    return (
      name === "http.client.request" &&
      typeof status === "number" &&
      (status === 0 || status >= minimumHttpStatus)
    );
  }
  if (status !== 0) {
    return false;
  }
  if (kind === "exception") {
    return (
      exceptionNames.has(name) &&
      errorType(item["errorType"]) !== undefined &&
      validErrorLocations(item["locations"])
    );
  }
  return kind === "vital" && vitalNames.has(name);
}

function isBrowserEvent(
  item: UntrustedFields,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): item is UntrustedFields & BrowserEvent {
  return (
    hasExactKeys(item) &&
    validMeasurements(item, labels, now) &&
    validIdentifiers(item) &&
    methods.has(item["method"]) &&
    validKind(item)
  );
}

function parseBrowserEvent(
  item: unknown,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): BrowserEvent {
  if (!isRecord(item) || !hasExactKeys(item)) {
    throw new Error("Invalid telemetry fields");
  }
  if (!validMeasurements(item, labels, now) || !validIdentifiers(item)) {
    throw new Error("Invalid telemetry value");
  }
  if (!methods.has(item["method"])) {
    throw new Error("Invalid telemetry method");
  }
  if (!isBrowserEvent(item, labels, now)) {
    throw new Error("Invalid telemetry event");
  }
  return { ...item };
}

function parseBrowserEvents(
  input: unknown,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): BrowserEvent[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > maximumBatchSize) {
    throw new Error("Invalid telemetry batch");
  }
  return input.map((item: unknown) => parseBrowserEvent(item, labels, now));
}

export { maximumBatchSize, maximumMeasurement, parseBrowserEvents };
export type { BrowserEvent };
