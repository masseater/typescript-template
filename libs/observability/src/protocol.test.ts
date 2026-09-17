import { describe, expect, it } from "vite-plus/test";
import {
  envelope,
  logRecord,
  parentContext,
  routeLabel,
  spanKind,
  spanRecord,
  validateRoutes,
} from "./protocol.ts";

const context = {
  requestId: "11111111-1111-4111-8111-111111111111",
  spanId: "bbbbbbbbbbbbbbbb",
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const now = 1_800_000_000_000;
const spanMilliseconds = 10;

describe("oTLP encoding", () => {
  it("encodes nanoseconds as decimal strings, IDs as hex and enums as numbers", () => {
    expect.hasAssertions();
    const log = logRecord({ context, failed: false, name: "x", time: now, values: {} });
    expect(log.timeUnixNano).toBe("1800000000000000000");
    const span = spanRecord({
      context,
      end: now + spanMilliseconds,
      failed: false,
      kind: spanKind.server,
      name: "GET home",
      start: now,
      values: {},
    });
    expect(span).toMatchObject({
      endTimeUnixNano: "1800000000010000000",
      kind: 2,
      spanId: context.spanId,
      status: { code: 0 },
      traceId: context.traceId,
    });
    const failure = logRecord({
      context,
      failed: true,
      name: "http.server.request",
      time: now,
      values: {},
    });
    expect(failure).toMatchObject({
      severityNumber: 17,
      spanId: context.spanId,
      traceId: context.traceId,
    });
  });

  it("keeps attribute order and appends the request ID", () => {
    expect.hasAssertions();
    const values = { accepted: true, status: 200 };
    const log = logRecord({ context, failed: false, name: "request", time: now, values });
    expect(log.attributes).toStrictEqual([
      { key: "accepted", value: { boolValue: true } },
      { key: "status", value: { doubleValue: 200 } },
      { key: "request.id", value: { stringValue: context.requestId } },
    ]);
  });
});

describe("oTLP resources", () => {
  it("distinguish browser/server and user/admin", () => {
    expect.hasAssertions();
    const logs = envelope({ records: [], runtime: "browser", service: "admin", signal: "logs" });
    const traces = envelope({ records: [], runtime: "server", service: "user", signal: "traces" });
    const metrics = envelope({
      records: [],
      runtime: "browser",
      service: "user",
      signal: "metrics",
    });
    expect(JSON.stringify(logs)).toContain("admin-browser");
    expect(JSON.stringify(traces)).toContain("user-server");
    expect(JSON.stringify(metrics)).toContain("scopeMetrics");
  });
});

describe("traceparent", () => {
  it("rejects zero IDs, extra fields and token-bearing strings", () => {
    expect.hasAssertions();
    expect(parentContext(`00-${context.traceId}-${context.spanId}-01`)).toStrictEqual({
      parentSpanId: context.spanId,
      traceId: context.traceId,
    });
    expect(
      parentContext(`00-${"0".repeat(context.traceId.length)}-${context.spanId}-01`),
    ).toBeUndefined();
    expect(parentContext(`00-${context.traceId}-${context.spanId}-01-token`)).toBeUndefined();
    expect(parentContext(null)).toBeUndefined();
  });
});

describe("route labels", () => {
  it("unknown URL paths cannot become telemetry labels", () => {
    expect.hasAssertions();
    const routes = { "/": "home", "/api/health": "health" };
    validateRoutes(routes);
    expect(routeLabel("/token/secret-user@example.com", routes)).toBe("unmatched");
    expect(routeLabel("/", routes)).toBe("home");
    expect(() => {
      validateRoutes({ "/": "private@example.com" });
    }).toThrow("bounded labels");
  });

  it("accepts terminal wildcards, prioritizes exact paths and never emits captured paths", () => {
    expect.hasAssertions();
    const routes = { "/api/*": "api", "/api/auth/*": "auth", "/api/auth/sign-in": "signin" };
    validateRoutes(routes);
    expect(
      ["/api/auth/sign-in", "/api/auth/token/private@example.com", "/api/authentic"].map((path) =>
        routeLabel(path, routes),
      ),
    ).toStrictEqual(["signin", "auth", "api"]);
    expect(() => {
      validateRoutes({ "/api/*/token": "bad" });
    }).toThrow("bounded labels");
    expect(() => {
      validateRoutes({ "/api/**": "bad" });
    }).toThrow("bounded labels");
  });
});
