import type { Attributes, Correlation, KeyValue } from "./protocol.ts";
import { attributes, nanoTime, nanosecondsPerMillisecond } from "./protocol.ts";
import histogramBounds from "./histogram-bounds.json" with { type: "json" };

interface Exemplar {
  readonly asDouble: number;
  readonly spanId: string;
  readonly timeUnixNano: string;
  readonly traceId: string;
}
interface HistogramPoint {
  readonly attributes: readonly KeyValue[];
  readonly bucketCounts: readonly string[];
  readonly count: string;
  readonly exemplars: readonly Exemplar[];
  readonly explicitBounds: readonly number[];
  readonly max: number;
  readonly min: number;
  readonly startTimeUnixNano: string;
  readonly sum: number;
  readonly timeUnixNano: string;
}
interface HistogramMetric {
  readonly histogram: {
    readonly aggregationTemporality: number;
    readonly dataPoints: readonly HistogramPoint[];
  };
  readonly name: string;
  readonly unit: string;
}
interface HistogramInput {
  readonly name: string;
  readonly unit: string;
  readonly value: number;
  readonly values: Attributes;
  readonly start: number;
  readonly end: number;
  readonly context: Correlation;
}
type MetricAccumulator = (
  records: readonly HistogramMetric[],
  namespace: string,
  now: number,
) => HistogramMetric[];

const aggregationTemporality = { cumulative: 2, delta: 1 } as const;
const maximumSeries = 4096;

function histogram(input: HistogramInput): HistogramMetric {
  const { context, end, start, unit, value } = input;
  const bounds = unit === "s" ? histogramBounds.seconds : histogramBounds.milliseconds;
  const index = bounds.findIndex((bound) => value <= bound);
  const bucket = index === -1 ? bounds.length : index;
  const point: HistogramPoint = {
    attributes: attributes(input.values),
    bucketCounts: Array.from({ length: bounds.length + 1 }, (_unused, position): string =>
      position === bucket ? "1" : "0",
    ),
    count: "1",
    exemplars: [
      {
        asDouble: value,
        spanId: context.spanId,
        timeUnixNano: nanoTime(end),
        traceId: context.traceId,
      },
    ],
    explicitBounds: bounds,
    max: value,
    min: value,
    startTimeUnixNano: nanoTime(start),
    sum: value,
    timeUnixNano: nanoTime(end),
  };
  return {
    histogram: { aggregationTemporality: aggregationTemporality.delta, dataPoints: [point] },
    name: input.name,
    unit,
  };
}

function seriesKey(namespace: string, metric: HistogramMetric, point: HistogramPoint): string {
  const ordered = point.attributes.toSorted((left, right) => left.key.localeCompare(right.key));
  return JSON.stringify([namespace, metric.name, metric.unit, ordered, point.explicitBounds]);
}

function mergePoints(base: HistogramPoint, input: HistogramPoint): HistogramPoint {
  return {
    ...base,
    bucketCounts: base.bucketCounts.map((count, index) =>
      String(BigInt(count) + BigInt(input.bucketCounts[index] ?? "0")),
    ),
    count: String(BigInt(base.count) + BigInt(input.count)),
    exemplars: [...base.exemplars, ...input.exemplars],
    max: Math.max(base.max, input.max),
    min: Math.min(base.min, input.min),
    sum: base.sum + input.sum,
  };
}

function snapshotPoint(
  input: HistogramPoint,
  previous: HistogramPoint | undefined,
  now: number,
): HistogramPoint {
  if (!previous) {
    return {
      ...structuredClone(input),
      startTimeUnixNano: nanoTime(now - 1),
      timeUnixNano: nanoTime(now),
    };
  }
  const previousMilliseconds = Number(BigInt(previous.timeUnixNano) / nanosecondsPerMillisecond);
  return {
    ...mergePoints(previous, input),
    timeUnixNano: nanoTime(Math.max(now, previousMilliseconds + 1)),
  };
}

function rememberSeries(
  series: Map<string, HistogramPoint>,
  batch: ReadonlyMap<string, HistogramMetric>,
): void {
  for (const [key, record] of batch) {
    const [point] = record.histogram.dataPoints;
    if (point) {
      if (!series.has(key) && series.size >= maximumSeries) {
        series.delete(series.keys().next().value ?? "");
      }
      series.set(key, { ...point, exemplars: [] });
    }
  }
}

function createMetricAccumulator(): MetricAccumulator {
  const series = new Map<string, HistogramPoint>();
  return (records, namespace, now) => {
    const batch = new Map<string, HistogramMetric>();
    for (const record of records) {
      for (const input of record.histogram.dataPoints) {
        const key = seriesKey(namespace, record, input);
        const [current] = batch.get(key)?.histogram.dataPoints ?? [];
        const point = current
          ? mergePoints(current, input)
          : snapshotPoint(input, series.get(key), now);
        batch.set(key, {
          ...record,
          histogram: {
            aggregationTemporality: aggregationTemporality.cumulative,
            dataPoints: [point],
          },
        });
      }
    }
    rememberSeries(series, batch);
    return [...batch.values()];
  };
}

export { createMetricAccumulator, histogram };
export type { HistogramMetric };
