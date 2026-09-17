import { Result, Schema } from "effect";
import { expect, test } from "vite-plus/test";
import { browserEvents } from "./events.ts";
import { parentContext, routeLabel, validateRoutes } from "./protocol.ts";

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
const labels = new Set(["home"]);
const parse = (input: unknown) =>
  Schema.decodeUnknownResult(browserEvents(labels, now), { onExcessProperty: "error" })(input);
const accepted = (input: unknown) => Result.isSuccess(parse(input));

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
  const result = parse([event]);
  expect(Result.isSuccess(result) && result.success).toEqual([event]);
  expect(accepted([{ ...event, profile: "private biography" }])).toBe(false);
  expect(accepted([{ ...event, route: "private@example.com" }])).toBe(false);
  expect(accepted([{ ...event, name: "Bearer private-token" }])).toBe(false);
  expect(accepted([{ ...event, duration: Infinity }])).toBe(false);
  expect(accepted([{ ...event, start: now - 4_000_000 }])).toBe(false);
  expect(accepted(Array.from({ length: 33 }, () => event))).toBe(false);
  expect(accepted([])).toBe(false);
});

test("browser exceptions carry only a known error type and bounded stack locations", () => {
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
  const result = parse([exception]);
  expect(Result.isSuccess(result) && result.success).toEqual([exception]);
  expect(accepted([{ ...exception, errorType: "Custom" }])).toBe(false);
  expect(accepted([{ ...exception, locations: "private@example.com" }])).toBe(false);
  const { errorType: _type, locations: _locations, ...withoutDetails } = exception;
  expect(accepted([withoutDetails])).toBe(false);
  expect(accepted([{ ...event, errorType: "TypeError" }])).toBe(false);
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
