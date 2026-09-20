import { readFile, rm } from "node:fs/promises";

import { Effect, Schema } from "effect";

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

type Report = {
  readonly crossed: readonly string[];
  readonly errorRate: number;
  readonly iterations: number;
  readonly latency: Readonly<Record<string, number>>;
  readonly requests: number;
};

type Metrics = Readonly<Record<string, typeof Metric.Type>>;

const crossedIn = (metric: string, measured: typeof Metric.Type): readonly string[] =>
  Object.entries(measured.thresholds ?? {})
    .filter(([, failed]) => failed)
    .map(([expression]) => `${metric} ${expression}`);

const crossedThresholds = (metrics: Metrics): readonly string[] =>
  Object.entries(metrics)
    .flatMap(([metric, measured]) => crossedIn(metric, measured))
    .toSorted();

const latencyMetric = /^http_req_duration\{name:(?<name>[^}]+)\}$/u;

const latencies = (metrics: Metrics): Readonly<Record<string, number>> =>
  Object.fromEntries(
    Object.entries(metrics).flatMap(([metric, measured]) => {
      const labelled = latencyMetric.exec(metric)?.groups?.name;
      const ninetyFifth = measured["p(95)"];
      return labelled === undefined || ninetyFifth === undefined
        ? []
        : [[labelled, Math.round(ninetyFifth)] as const];
    }),
  );

const summarise = (metrics: typeof Summary.Type.metrics): Report => {
  return {
    crossed: crossedThresholds(metrics),
    errorRate: metrics.http_req_failed.value,
    iterations: metrics.iterations.count,
    latency: latencies(metrics),
    requests: metrics.http_reqs.count,
  };
};

const readSummary = (file: string): Effect.Effect<Report, unknown> => {
  return Effect.tryPromise(async (): Promise<unknown> =>
    JSON.parse(await readFile(file, "utf-8")),
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Summary)),
    Effect.map((summary) => summarise(summary.metrics)),
  );
};

class SummaryNotDiscarded extends Schema.TaggedError<SummaryNotDiscarded>()(
  "SummaryNotDiscarded",
  {},
) {}

const discardSummary = (file: string): Effect.Effect<void, SummaryNotDiscarded> => {
  return Effect.tryPromise({
    catch: () => new SummaryNotDiscarded(),
    try: async () => rm(file, { force: true }),
  });
};

export { discardSummary, readSummary };
export type { Report };
