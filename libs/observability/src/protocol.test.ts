import { expect, test } from "vitest";
import {
  envelope,
  createMetricAccumulator,
  histogram,
  logRecord,
  parentContext,
  routeLabel,
  spanRecord,
  validateRoutes,
} from "./protocol.ts";
import { parseBrowserEvents } from "./events.ts";

const context = {
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
  requestId: "11111111-1111-4111-8111-111111111111",
};
const now = 1_800_000_000_000;
const event = {
  ...context,
  kind: "http",
  route: "home",
  start: now,
  duration: 10,
  status: 200,
  method: "GET",
  name: "http.client.request",
  value: 0,
};

test("batches same-series observations into cumulative snapshots unique at millisecond precision", () => {
  const accumulate = createMetricAccumulator();
  const record = histogram(
    "http.client.request.duration",
    "s",
    0.02,
    { "http.route": "home" },
    now,
    now + 20,
    context,
  );
  const first = accumulate([record, record], "user-browser", now);
  expect(first).toHaveLength(1);
  expect(first[0]?.histogram.aggregationTemporality).toBe(2);
  const point = first[0]?.histogram.dataPoints[0];
  expect(point?.count).toBe("2");
  expect(point?.sum).toBe(0.04);
  expect(point?.bucketCounts.reduce((sum, value) => sum + Number(value), 0)).toBe(2);
  expect(point?.exemplars).toHaveLength(2);
  const second = accumulate([record], "user-browser", now);
  const next = second[0]?.histogram.dataPoints[0];
  expect(next?.count).toBe("3");
  expect(BigInt(next!.timeUnixNano) / 1_000_000n).toBe(
    BigInt(point!.timeUnixNano) / 1_000_000n + 1n,
  );
  expect(next?.startTimeUnixNano).toBe(point?.startTimeUnixNano);
  expect(next?.exemplars).toHaveLength(1);
  expect(point?.count).toBe("2");
  expect(accumulate([record], "admin-browser", now)[0]?.histogram.dataPoints[0]?.count).toBe("1");
  expect(record.histogram.dataPoints[0]?.count).toBe("1");
});

test("OTLP encodes nanoseconds as decimal strings, IDs as hex and enums as numbers", () => {
  expect(logRecord("x", {}, context, now, false).timeUnixNano).toBe("1800000000000000000");
  const span = spanRecord("GET home", {}, context, now, now + 10, 2, false);
  expect(span).toMatchObject({
    traceId: context.traceId,
    spanId: context.spanId,
    kind: 2,
    status: { code: 0 },
    endTimeUnixNano: "1800000000010000000",
  });
  expect(logRecord("http.server.request", {}, context, now, true)).toMatchObject({
    severityNumber: 17,
    traceId: context.traceId,
    spanId: context.spanId,
  });
  expect(
    logRecord("request", { status: 200, accepted: true }, context, now, false).attributes,
  ).toEqual([
    { key: "status", value: { doubleValue: 200 } },
    { key: "accepted", value: { boolValue: true } },
    { key: "request.id", value: { stringValue: context.requestId } },
  ]);
});

test("latency histogram has one bucket observation and an exemplar without request IDs as metric labels", () => {
  const metric = histogram(
    "http.server.request.duration",
    "s",
    0.02,
    { "http.route": "home" },
    now,
    now + 20,
    context,
  );
  const point = metric.histogram.dataPoints[0];
  expect(point?.bucketCounts.filter((count) => count === "1")).toHaveLength(1);
  expect(point?.sum).toBe(0.02);
  expect(point?.count).toBe("1");
  expect(JSON.stringify(point?.attributes)).not.toContain(context.requestId);
  expect(point?.exemplars[0]?.traceId).toBe(context.traceId);
});

test("OTLP resources distinguish browser/server and user/admin", () => {
  expect(JSON.stringify(envelope("logs", [], "admin", "browser"))).toContain("admin-browser");
  expect(JSON.stringify(envelope("traces", [], "user", "server"))).toContain("user-server");
  expect(JSON.stringify(envelope("metrics", [], "user", "browser"))).toContain("scopeMetrics");
});

test("traceparent rejects zero IDs, extra fields and token-bearing strings", () => {
  expect(parentContext(`00-${context.traceId}-${context.spanId}-01`)).toEqual({
    traceId: context.traceId,
    parentSpanId: context.spanId,
  });
  expect(parentContext(`00-${"0".repeat(32)}-${context.spanId}-01`)).toBeUndefined();
  expect(parentContext(`00-${context.traceId}-${context.spanId}-01-token`)).toBeUndefined();
  expect(parentContext(null)).toBeUndefined();
});

test("unknown URL paths cannot become telemetry labels", () => {
  const routes = { "/": "home", "/api/health": "health" };
  validateRoutes(routes);
  expect(routeLabel("/token/secret-user@example.com", routes)).toBe("unmatched");
  expect(routeLabel("/", routes)).toBe("home");
  expect(() => validateRoutes({ "/": "private@example.com" })).toThrow("bounded labels");
});

test("browser ingress rejects PII, arbitrary fields, forged labels and unbounded batches", () => {
  const labels = new Set(["home"]);
  expect(parseBrowserEvents([event], labels, now)).toEqual([event]);
  expect(() =>
    parseBrowserEvents([{ ...event, profile: "private biography" }], labels, now),
  ).toThrow("fields");
  expect(() =>
    parseBrowserEvents([{ ...event, route: "private@example.com" }], labels, now),
  ).toThrow("value");
  expect(() =>
    parseBrowserEvents([{ ...event, name: "Bearer private-token" }], labels, now),
  ).toThrow("event");
  expect(() => parseBrowserEvents([{ ...event, duration: Infinity }], labels, now)).toThrow(
    "value",
  );
  expect(() => parseBrowserEvents([{ ...event, start: now - 4_000_000 }], labels, now)).toThrow(
    "value",
  );
  expect(() =>
    parseBrowserEvents(
      Array.from({ length: 33 }, () => event),
      labels,
      now,
    ),
  ).toThrow("batch");
});

test("browser exceptions carry only a known error type and bounded stack locations", () => {
  const labels = new Set(["home"]);
  const exception = {
    ...event,
    kind: "exception",
    name: "browser.error",
    status: 0,
    method: "GET",
    value: 1,
    errorType: "TypeError",
    locations: "/assets/index-abc.js:1:234\n/assets/auth-def.js:5:6",
  };
  expect(parseBrowserEvents([exception], labels, now)).toEqual([exception]);
  expect(() => parseBrowserEvents([{ ...exception, errorType: "Custom" }], labels, now)).toThrow(
    "event",
  );
  expect(() =>
    parseBrowserEvents([{ ...exception, locations: "private@example.com" }], labels, now),
  ).toThrow("event");
  const { errorType: _type, locations: _locations, ...withoutDetails } = exception;
  expect(() => parseBrowserEvents([withoutDetails], labels, now)).toThrow("fields");
  expect(() => parseBrowserEvents([{ ...event, errorType: "TypeError" }], labels, now)).toThrow(
    "fields",
  );
});

test("route matching accepts terminal wildcards, prioritizes exact paths and never emits captured paths", () => {
  const routes = { "/api/*": "api", "/api/auth/*": "auth", "/api/auth/sign-in": "signin" };
  validateRoutes(routes);
  expect(routeLabel("/api/auth/sign-in", routes)).toBe("signin");
  expect(routeLabel("/api/auth/token/private@example.com", routes)).toBe("auth");
  expect(routeLabel("/api/authentic", routes)).toBe("api");
  expect(() => validateRoutes({ "/api/*/token": "bad" })).toThrow("bounded labels");
  expect(() => validateRoutes({ "/api/**": "bad" })).toThrow("bounded labels");
});
