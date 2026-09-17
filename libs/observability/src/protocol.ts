export type ServiceName = "user" | "admin" | "wiki";
export type Signal = "logs" | "metrics" | "traces";
export type Attributes = Record<string, string | number | boolean>;
export type Correlation = { traceId: string; spanId: string; requestId: string };

const scope = { name: "@template/observability", version: "1.0.0" };
let instanceId: string | undefined;
const nanoTime = (milliseconds: number): string =>
  (BigInt(Math.floor(milliseconds * 1_000)) * 1_000n).toString();
export const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
export const validTraceId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{32}$/.test(value) && !/^0+$/.test(value);
export const validSpanId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{16}$/.test(value) && !/^0+$/.test(value);
export const validRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export function parentContext(value: string | null) {
  const match = value?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/);
  if (!match || !validTraceId(match[1]) || !validSpanId(match[2])) return undefined;
  return { traceId: match[1], parentSpanId: match[2] };
}

function attributes(values: Attributes) {
  return Object.entries(values).map(([key, value]) => ({
    key,
    value:
      typeof value === "string"
        ? { stringValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { doubleValue: value },
  }));
}

function resource(service: ServiceName, runtime: "browser" | "server") {
  instanceId ??= crypto.randomUUID();
  return {
    attributes: attributes({
      "service.name": `${service}-${runtime}`,
      "service.namespace": "typescript-template",
      "service.instance.id": instanceId,
    }),
  };
}

export function logRecord(
  name: string,
  values: Attributes,
  context: Correlation,
  time: number,
  failed: boolean,
) {
  return {
    timeUnixNano: nanoTime(time),
    observedTimeUnixNano: nanoTime(time),
    severityNumber: failed ? 17 : 9,
    severityText: failed ? "ERROR" : "INFO",
    body: { stringValue: name },
    attributes: attributes({ ...values, "request.id": context.requestId }),
    traceId: context.traceId,
    spanId: context.spanId,
    flags: 1,
  };
}

export function spanRecord(
  name: string,
  values: Attributes,
  context: Correlation,
  start: number,
  end: number,
  kind: number,
  failed: boolean,
  parentSpanId?: string,
) {
  return {
    name,
    traceId: context.traceId,
    spanId: context.spanId,
    ...(parentSpanId ? { parentSpanId } : {}),
    kind,
    startTimeUnixNano: nanoTime(start),
    endTimeUnixNano: nanoTime(end),
    attributes: attributes({ ...values, "request.id": context.requestId }),
    status: { code: failed ? 2 : 0 },
    flags: 1,
  };
}

export function histogram(
  name: string,
  unit: string,
  value: number,
  values: Attributes,
  start: number,
  end: number,
  context: Correlation,
) {
  const bounds =
    unit === "s"
      ? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
      : [0.1, 1, 10, 100, 500, 1000, 2500, 5000, 10000];
  const index = bounds.findIndex((bound) => value <= bound);
  return {
    name,
    unit,
    histogram: {
      aggregationTemporality: 1,
      dataPoints: [
        {
          attributes: attributes(values),
          startTimeUnixNano: nanoTime(start),
          timeUnixNano: nanoTime(end),
          count: "1",
          sum: value,
          min: value,
          max: value,
          explicitBounds: bounds,
          bucketCounts: Array.from({ length: bounds.length + 1 }, (_, i): string =>
            i === (index < 0 ? bounds.length : index) ? "1" : "0",
          ),
          exemplars: [
            {
              timeUnixNano: nanoTime(end),
              asDouble: value,
              traceId: context.traceId,
              spanId: context.spanId,
            },
          ],
        },
      ],
    },
  };
}

type Histogram = ReturnType<typeof histogram>;
type HistogramPoint = Histogram["histogram"]["dataPoints"][number];

export function createMetricAccumulator() {
  const series = new Map<string, HistogramPoint>();
  return (records: Histogram[], namespace: string, now: number): Histogram[] => {
    const batch = new Map<string, Histogram>();
    for (const record of records) {
      for (const input of record.histogram.dataPoints) {
        const ordered = [...input.attributes].sort((left, right) =>
          left.key.localeCompare(right.key),
        );
        const key = JSON.stringify([
          namespace,
          record.name,
          record.unit,
          ordered,
          input.explicitBounds,
        ]);
        const current = batch.get(key)?.histogram.dataPoints[0];
        const previous = current ?? series.get(key);
        const point: HistogramPoint = previous
          ? {
              ...previous,
              count: String(BigInt(previous.count) + BigInt(input.count)),
              sum: previous.sum + input.sum,
              min: Math.min(previous.min, input.min),
              max: Math.max(previous.max, input.max),
              bucketCounts: previous.bucketCounts.map((count, index) =>
                String(BigInt(count) + BigInt(input.bucketCounts[index] ?? "0")),
              ),
              exemplars: [...(current?.exemplars ?? []), ...input.exemplars],
            }
          : structuredClone(input);
        if (!current) {
          const timestamp = Math.max(
            now,
            previous ? Number(BigInt(previous.timeUnixNano) / 1_000_000n) + 1 : now,
          );
          point.timeUnixNano = nanoTime(timestamp);
          if (!previous) point.startTimeUnixNano = nanoTime(now - 1);
        }
        batch.set(key, {
          ...record,
          histogram: { aggregationTemporality: 2, dataPoints: [point] },
        });
      }
    }
    for (const [key, record] of batch) {
      const point = record.histogram.dataPoints[0];
      if (!point) continue;
      if (!series.has(key) && series.size >= 4096) series.delete(series.keys().next().value ?? "");
      series.set(key, { ...point, exemplars: [] });
    }
    return [...batch.values()];
  };
}

export function envelope(
  signal: Signal,
  records: unknown[],
  service: ServiceName,
  runtime: "browser" | "server",
) {
  const common = { resource: resource(service, runtime) };
  if (signal === "logs")
    return { resourceLogs: [{ ...common, scopeLogs: [{ scope, logRecords: records }] }] };
  if (signal === "traces")
    return { resourceSpans: [{ ...common, scopeSpans: [{ scope, spans: records }] }] };
  return { resourceMetrics: [{ ...common, scopeMetrics: [{ scope, metrics: records }] }] };
}

export const httpMethod = (method: string): string =>
  ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method) ? method : "_OTHER";

export function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) return routes[pathname] ?? "unmatched";
  const prefixes = Object.entries(routes)
    .filter(([path]) => path.endsWith("/*"))
    .sort(([left], [right]) => right.length - left.length);
  return prefixes.find(([path]) => pathname.startsWith(path.slice(0, -1)))?.[1] ?? "unmatched";
}

export function validateRoutes(routes: Readonly<Record<string, string>>) {
  for (const [path, label] of Object.entries(routes)) {
    if (
      !path.startsWith("/") ||
      path.includes("?") ||
      path.includes("#") ||
      (path.includes("*") && (!path.endsWith("/*") || path.slice(0, -1).includes("*"))) ||
      !/^[a-z][a-z0-9_.-]{0,63}$/.test(label)
    ) {
      throw new Error("Telemetry routes require fixed paths and bounded labels");
    }
  }
}
