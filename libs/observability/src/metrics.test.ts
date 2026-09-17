import { createMetricAccumulator, histogram } from "./metrics.ts";
import { describe, expect, it } from "vitest";
import type { HistogramMetric } from "./metrics.ts";

type HistogramPoint = HistogramMetric["histogram"]["dataPoints"][number];

const context = {
  requestId: "11111111-1111-4111-8111-111111111111",
  spanId: "bbbbbbbbbbbbbbbb",
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const now = 1_800_000_000_000;
const requestMilliseconds = 20;
const requestSeconds = 0.02;
const nanosecondsPerMillisecond = 1_000_000n;

function homeHistogram(name: string): HistogramMetric {
  return histogram({
    context,
    end: now + requestMilliseconds,
    name,
    start: now,
    unit: "s",
    value: requestSeconds,
    values: { "http.route": "home" },
  });
}

function firstPoint(metrics: readonly HistogramMetric[]): HistogramPoint | undefined {
  return metrics[0]?.histogram.dataPoints[0];
}

function milliseconds(nanoseconds: string | undefined): bigint {
  return BigInt(nanoseconds ?? "0") / nanosecondsPerMillisecond;
}

describe("metric accumulation", () => {
  it("batches same-series observations into one cumulative snapshot", () => {
    expect.hasAssertions();
    const record = homeHistogram("http.client.request.duration");
    const first = createMetricAccumulator()([record, record], "user-browser", now);
    const point = firstPoint(first);
    expect(first).toHaveLength(1);
    expect(first[0]?.histogram).toMatchObject({ aggregationTemporality: 2 });
    expect(point).toMatchObject({ count: "2", sum: 0.04 });
    expect({
      buckets: point?.bucketCounts.reduce((sum, value) => sum + Number(value), 0),
      exemplars: point?.exemplars.length,
    }).toStrictEqual({ buckets: 2, exemplars: 2 });
  });

  it("keeps snapshots unique at millisecond precision across batches", () => {
    expect.hasAssertions();
    const accumulate = createMetricAccumulator();
    const record = homeHistogram("http.client.request.duration");
    const point = firstPoint(accumulate([record, record], "user-browser", now));
    const next = firstPoint(accumulate([record], "user-browser", now));
    expect(next).toMatchObject({ count: "3", startTimeUnixNano: point?.startTimeUnixNano });
    expect(milliseconds(next?.timeUnixNano)).toBe(milliseconds(point?.timeUnixNano) + 1n);
    expect(next?.exemplars).toHaveLength(1);
    expect(point?.count).toBe("2");
  });

  it("separates namespaces without mutating the observed record", () => {
    expect.hasAssertions();
    const accumulate = createMetricAccumulator();
    const record = homeHistogram("http.client.request.duration");
    accumulate([record, record], "user-browser", now);
    const admin = firstPoint(accumulate([record], "admin-browser", now));
    expect(admin?.count).toBe("1");
    expect(record.histogram.dataPoints[0]?.count).toBe("1");
  });
});

describe("latency histogram", () => {
  it("has one bucket observation and an exemplar without request IDs as metric labels", () => {
    expect.hasAssertions();
    const [point] = homeHistogram("http.server.request.duration").histogram.dataPoints;
    expect(point?.bucketCounts.filter((count) => count === "1")).toHaveLength(1);
    expect(point).toMatchObject({ count: "1", sum: requestSeconds });
    expect(JSON.stringify(point?.attributes)).not.toContain(context.requestId);
    expect(point?.exemplars[0]?.traceId).toBe(context.traceId);
  });
});
