import { describe, expect, it } from "vite-plus/test";
import { isRoutes, parentContext, routeLabel } from "./protocol.ts";

const context = {
  requestId: "11111111-1111-4111-8111-111111111111",
  spanId: "bbbbbbbbbbbbbbbb",
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

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
    // oxlint-disable-next-line unicorn/no-null
    expect(parentContext(null)).toBeUndefined();
  });
});

describe("route labels", () => {
  it("unknown URL paths cannot become telemetry labels", () => {
    expect.hasAssertions();
    const routes = { "/": "home", "/api/health": "health" };
    expect(isRoutes(routes)).toBe(true);
    expect(routeLabel("/token/secret-user@example.com", routes)).toBe("unmatched");
    expect(routeLabel("/", routes)).toBe("home");
    expect(isRoutes({ "/": "private@example.com" })).toBe(false);
  });

  it("accepts terminal wildcards, prioritizes exact paths and never emits captured paths", () => {
    expect.hasAssertions();
    const routes = { "/api/*": "api", "/api/auth/*": "auth", "/api/auth/sign-in": "signin" };
    expect(isRoutes(routes)).toBe(true);
    expect(
      ["/api/auth/sign-in", "/api/auth/token/private@example.com", "/api/authentic"].map((path) =>
        routeLabel(path, routes),
      ),
    ).toStrictEqual(["signin", "auth", "api"]);
    expect([isRoutes({ "/api/*/token": "bad" }), isRoutes({ "/api/**": "bad" })]).toStrictEqual([
      false,
      false,
    ]);
  });
});
