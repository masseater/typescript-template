import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Schema } from "effect";

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

const readSummary = (file: string): Effect.Effect<Report, Schema.SchemaError> =>
  Effect.gen(function* readMeasuredSummary() {
    const filesystem = yield* FileSystem.FileSystem;
    const summaryText = yield* filesystem.readFileString(file).pipe(Effect.orDie);
    const summary = yield* Schema.decodeEffect(Schema.fromJsonString(Summary))(summaryText);
    return summarise(summary.metrics);
  }).pipe(Effect.provide(NodeServices.layer));

class SummaryNotDiscarded extends Schema.TaggedError<SummaryNotDiscarded>()(
  "SummaryNotDiscarded",
  {},
) {}

const discardSummary = (file: string): Effect.Effect<void, SummaryNotDiscarded> =>
  Effect.gen(function* discardMeasuredSummary() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .remove(file, { force: true })
      .pipe(Effect.mapError(() => new SummaryNotDiscarded()));
  }).pipe(Effect.provide(NodeServices.layer));

export { discardSummary, readSummary };
export type { Report };
