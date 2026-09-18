import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, rm } from "node:fs/promises";

const Thresholds = Schema.Record(Schema.String, Schema.Boolean);
const Metric = Schema.Struct({
  count: Schema.optionalKey(Schema.Finite),
  "p(95)": Schema.optionalKey(Schema.Finite),
  thresholds: Schema.optionalKey(Thresholds),
  value: Schema.optionalKey(Schema.Finite),
});
const Counter = Schema.Struct({ ...Metric.fields, count: Schema.Finite });
const Rate = Schema.Struct({ ...Metric.fields, value: Schema.Finite });
const Summary = Schema.Struct({
  metrics: Schema.StructWithRest(
    Schema.Struct({ http_req_failed: Rate, http_reqs: Counter, iterations: Counter }),
    [Schema.Record(Schema.String, Metric)],
  ),
});

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

function summarise(metrics: typeof Summary.Type.metrics): Report {
  return {
    crossed: crossedThresholds(metrics),
    errorRate: metrics.http_req_failed.value,
    iterations: metrics.iterations.count,
    latency: latencies(metrics),
    requests: metrics.http_reqs.count,
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

class SummaryNotDiscarded extends Schema.TaggedError<SummaryNotDiscarded>()(
  "SummaryNotDiscarded",
  {},
) {}

function discardSummary(file: string): Effect.Effect<void, SummaryNotDiscarded> {
  return Effect.tryPromise({
    catch: () => new SummaryNotDiscarded(),
    try: async () => rm(file, { force: true }),
  });
}

export { discardSummary, readSummary };
export type { Report };
