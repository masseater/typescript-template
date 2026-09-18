import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

const Thresholds = Schema.Record(Schema.String, Schema.Boolean);
const Metric = Schema.Struct({
  count: Schema.optionalKey(Schema.Finite),
  "p(95)": Schema.optionalKey(Schema.Finite),
  thresholds: Schema.optionalKey(Thresholds),
  value: Schema.optionalKey(Schema.Finite),
});
const Summary = Schema.Struct({ metrics: Schema.Record(Schema.String, Metric) });

type Metrics = Readonly<Record<string, typeof Metric.Type>>;

interface Report {
  readonly crossed: readonly string[];
  readonly errorRate: number;
  readonly iterations: number;
  readonly latency: Readonly<Record<string, number>>;
  readonly requests: number;
}

const latencyMetric = /^http_req_duration\{name:(?<name>[^}]+)\}$/u;

function crossedThresholds(metrics: Metrics): string[] {
  const crossed: string[] = [];
  for (const [metric, measured] of Object.entries(metrics)) {
    for (const [expression, failed] of Object.entries(measured.thresholds ?? {})) {
      if (failed) {
        crossed.push(`${metric} ${expression}`);
      }
    }
  }
  return crossed.toSorted();
}

function latencies(metrics: Metrics): Record<string, number> {
  const latency: Record<string, number> = {};
  for (const [metric, measured] of Object.entries(metrics)) {
    const name = latencyMetric.exec(metric)?.groups?.["name"];
    const value = measured["p(95)"];
    if (name !== undefined && value !== undefined) {
      latency[name] = Math.round(value);
    }
  }
  return latency;
}

function summarise(metrics: Metrics): Report {
  return {
    crossed: crossedThresholds(metrics),
    errorRate: metrics["http_req_failed"]?.value ?? 1,
    iterations: metrics["iterations"]?.count ?? 0,
    latency: latencies(metrics),
    requests: metrics["http_reqs"]?.count ?? 0,
  };
}

function readSummary(file: string): Effect.Effect<Report, unknown> {
  return Effect.tryPromise(async (): Promise<unknown> =>
    JSON.parse(await readFile(file, "utf-8")),
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Summary)),
    Effect.map((summary) => summarise(summary.metrics)),
  );
}

export { readSummary };
export type { Report };
