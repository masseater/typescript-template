type ServiceName = "user" | "admin" | "wiki";
type Signal = "logs" | "metrics" | "traces";
type TelemetryRuntime = "browser" | "server";
type Attributes = Readonly<Record<string, string | number | boolean>>;
interface Correlation {
  readonly traceId: string;
  readonly spanId: string;
  readonly requestId: string;
}
type AnyValue =
  | { readonly stringValue: string }
  | { readonly boolValue: boolean }
  | { readonly doubleValue: number };
interface KeyValue {
  readonly key: string;
  readonly value: AnyValue;
}
interface ParentContext {
  readonly parentSpanId: string;
  readonly traceId: string;
}
interface LogRecord {
  readonly attributes: readonly KeyValue[];
  readonly body: { readonly stringValue: string };
  readonly flags: number;
  readonly observedTimeUnixNano: string;
  readonly severityNumber: number;
  readonly severityText: "ERROR" | "INFO";
  readonly spanId: string;
  readonly timeUnixNano: string;
  readonly traceId: string;
}
interface SpanRecord {
  readonly attributes: readonly KeyValue[];
  readonly endTimeUnixNano: string;
  readonly flags: number;
  readonly kind: number;
  readonly name: string;
  readonly parentSpanId?: string;
  readonly spanId: string;
  readonly startTimeUnixNano: string;
  readonly status: { readonly code: number };
  readonly traceId: string;
}
interface LogInput {
  readonly name: string;
  readonly values: Attributes;
  readonly context: Correlation;
  readonly time: number;
  readonly failed: boolean;
}
interface SpanInput {
  readonly name: string;
  readonly values: Attributes;
  readonly context: Correlation;
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
  readonly failed: boolean;
  readonly parentSpanId?: string | undefined;
}
interface EnvelopeInput {
  readonly signal: Signal;
  readonly records: readonly unknown[];
  readonly service: ServiceName;
  readonly runtime: TelemetryRuntime;
}
interface Scope {
  readonly name: string;
  readonly version: string;
}
interface Resource {
  readonly attributes: readonly KeyValue[];
}
type Envelope =
  | {
      readonly resourceLogs: readonly {
        readonly resource: Resource;
        readonly scopeLogs: readonly {
          readonly logRecords: readonly unknown[];
          readonly scope: Scope;
        }[];
      }[];
    }
  | {
      readonly resourceSpans: readonly {
        readonly resource: Resource;
        readonly scopeSpans: readonly {
          readonly scope: Scope;
          readonly spans: readonly unknown[];
        }[];
      }[];
    }
  | {
      readonly resourceMetrics: readonly {
        readonly resource: Resource;
        readonly scopeMetrics: readonly {
          readonly metrics: readonly unknown[];
          readonly scope: Scope;
        }[];
      }[];
    };

const spanKind = { client: 3, internal: 1, server: 2 } as const;
type SpanKind = (typeof spanKind)[keyof typeof spanKind];
const severity = { error: 17, info: 9 } as const;
const spanStatus = { error: 2, unset: 0 } as const;
const sampledFlags = 1;
const traceIdBytes = 16;
const spanIdBytes = 8;
const hexRadix = 16;
const hexByteWidth = 2;
const millisecondsPerSecond = 1000;
const microsecondsPerMillisecond = 1000;
const nanosecondsPerMicrosecond = 1000n;
const nanosecondsPerMillisecond = 1_000_000n;
const scope: Scope = { name: "@template/observability", version: "1.0.0" };
const instance: { id?: string } = {};

function nanoTime(milliseconds: number): string {
  const microseconds = BigInt(Math.floor(milliseconds * microsecondsPerMillisecond));
  return (microseconds * nanosecondsPerMicrosecond).toString();
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(hexRadix).padStart(hexByteWidth, "0"),
  ).join("");
}

function validTraceId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/u.test(value) && !/^0+$/u.test(value);
}

function validSpanId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/u.test(value) && !/^0+$/u.test(value);
}

function validRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
  );
}

function parentContext(value: string | null): ParentContext | undefined {
  const groups = value?.match(
    /^00-(?<traceId>[0-9a-f]{32})-(?<parentSpanId>[0-9a-f]{16})-0[01]$/u,
  )?.groups;
  const traceId = groups?.["traceId"];
  const parentSpanId = groups?.["parentSpanId"];
  return validTraceId(traceId) && validSpanId(parentSpanId) ? { parentSpanId, traceId } : undefined;
}

function anyValue(value: string | number | boolean): AnyValue {
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  return { doubleValue: value };
}

function attributes(values: Attributes): KeyValue[] {
  return Object.entries(values).map(([key, value]) => ({ key, value: anyValue(value) }));
}

function resource(service: ServiceName, runtime: TelemetryRuntime): Resource {
  instance.id ??= crypto.randomUUID();
  return {
    attributes: attributes({
      "service.instance.id": instance.id,
      "service.name": `${service}-${runtime}`,
      "service.namespace": "typescript-template",
    }),
  };
}

function logRecord(input: LogInput): LogRecord {
  const { context, failed, name, time, values } = input;
  return {
    attributes: attributes({ ...values, "request.id": context.requestId }),
    body: { stringValue: name },
    flags: sampledFlags,
    observedTimeUnixNano: nanoTime(time),
    severityNumber: failed ? severity.error : severity.info,
    severityText: failed ? "ERROR" : "INFO",
    spanId: context.spanId,
    timeUnixNano: nanoTime(time),
    traceId: context.traceId,
  };
}

function spanRecord(input: SpanInput): SpanRecord {
  const { context, parentSpanId } = input;
  return {
    attributes: attributes({ ...input.values, "request.id": context.requestId }),
    endTimeUnixNano: nanoTime(input.end),
    flags: sampledFlags,
    kind: input.kind,
    name: input.name,
    ...(parentSpanId === undefined || parentSpanId === "" ? {} : { parentSpanId }),
    spanId: context.spanId,
    startTimeUnixNano: nanoTime(input.start),
    status: { code: input.failed ? spanStatus.error : spanStatus.unset },
    traceId: context.traceId,
  };
}

function envelope(input: EnvelopeInput): Envelope {
  const { records, signal } = input;
  const common = { resource: resource(input.service, input.runtime) };
  if (signal === "logs") {
    return { resourceLogs: [{ ...common, scopeLogs: [{ logRecords: records, scope }] }] };
  }
  if (signal === "traces") {
    return { resourceSpans: [{ ...common, scopeSpans: [{ scope, spans: records }] }] };
  }
  return { resourceMetrics: [{ ...common, scopeMetrics: [{ metrics: records, scope }] }] };
}

function httpMethod(method: string): string {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method)
    ? method
    : "_OTHER";
}

function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) {
    return routes[pathname] ?? "unmatched";
  }
  const prefixes = Object.entries(routes)
    .filter(([path]) => path.endsWith("/*"))
    .toSorted(([left], [right]) => right.length - left.length);
  return prefixes.find(([path]) => pathname.startsWith(path.slice(0, -1)))?.[1] ?? "unmatched";
}

function validRoute(path: string, label: string): boolean {
  const wildcard = path.includes("*");
  return (
    path.startsWith("/") &&
    !path.includes("?") &&
    !path.includes("#") &&
    (!wildcard || (path.endsWith("/*") && !path.slice(0, -1).includes("*"))) &&
    /^[a-z][a-z0-9_.-]{0,63}$/u.test(label)
  );
}

function validateRoutes(routes: Readonly<Record<string, string>>): void {
  if (Object.entries(routes).some(([path, label]) => !validRoute(path, label))) {
    throw new Error("Telemetry routes require fixed paths and bounded labels");
  }
}

export {
  attributes,
  envelope,
  httpMethod,
  logRecord,
  millisecondsPerSecond,
  nanoTime,
  nanosecondsPerMillisecond,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  spanKind,
  spanRecord,
  traceIdBytes,
  validRequestId,
  validSpanId,
  validTraceId,
  validateRoutes,
};
export type {
  Attributes,
  Correlation,
  KeyValue,
  LogRecord,
  ServiceName,
  Signal,
  SpanRecord,
  TelemetryRuntime,
};
