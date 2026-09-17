import type { Attributes, Correlation, LogRecord, ServiceName, SpanRecord } from "./protocol.ts";
import type { Exporter } from "./exporter.ts";
import type { HistogramMetric } from "./metrics.ts";
import { histogram } from "./metrics.ts";
import { millisecondsPerSecond } from "./protocol.ts";

interface RequestContext extends Correlation {
  readonly traceparent: string;
}
interface Telemetry {
  readonly exporter: Exporter;
  readonly routes: Readonly<Record<string, string>>;
  readonly serviceName: ServiceName;
}
interface Timing {
  readonly start: number;
  readonly duration: number;
}
type ServerRecord =
  | { readonly signal: "logs"; readonly record: LogRecord }
  | { readonly signal: "metrics"; readonly record: HistogramMetric }
  | { readonly signal: "traces"; readonly record: SpanRecord };

function traceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`;
}

function durationMetric(
  name: string,
  values: Attributes,
  observation: Timing & { readonly context: Correlation },
): HistogramMetric {
  const { context, duration, start } = observation;
  return histogram({
    context,
    end: start + duration,
    name,
    start,
    unit: "s",
    value: duration / millisecondsPerSecond,
    values,
  });
}

function enqueueServer(telemetry: Telemetry, entries: readonly ServerRecord[]): void {
  for (const { record, signal } of entries) {
    telemetry.exporter.enqueue({ records: [record], runtime: "server", signal });
  }
}

export { durationMetric, enqueueServer, traceparent };
export type { RequestContext, Telemetry, Timing };
