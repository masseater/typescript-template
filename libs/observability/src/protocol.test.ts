import { describe, expect, test } from "vite-plus/test";

import { isRoutes, parentContext, routeLabel, traceparentOf } from "./protocol.ts";

const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";

describe("traceparentOf", () => {
  const it = test.extend("header", () => traceparentOf({ spanId, traceId }));

  it("writes a sampled W3C traceparent", ({ header }) => {
    expect(header).toBe(`00-${traceId}-${spanId}-01`);
  });
});

describe("parentContext", () => {
  describe("a well-formed traceparent", () => {
    const it = test.extend("parent", () => parentContext(`00-${traceId}-${spanId}-01`));

    it("hands back the trace and the parent span", ({ parent }) => {
      expect(parent).toStrictEqual({ parentSpanId: spanId, traceId });
    });
  });

  describe.for([
    ["a trace id of zeros", `00-${"0".repeat(traceId.length)}-${spanId}-01`],
    ["a span id of zeros", `00-${traceId}-${"0".repeat(spanId.length)}-01`],
    ["a trailing token", `00-${traceId}-${spanId}-01-token`],
    ["no header at all", null],
  ] as const)("a traceparent carrying %s", ([, traceparent]) => {
    const it = test.extend("parent", () => parentContext(traceparent));

    it("is not a parent", ({ parent }) => {
      expect(parent).toBe(undefined);
    });
  });
});

describe("routeLabel", () => {
  describe.for([
    ["/", "home"],
    ["/token/secret-user@example.com", "unmatched"],
  ] as const)("the path %s against fixed routes", ([pathname, expectedLabel]) => {
    const it = test.extend("matchedRoute", () =>
      routeLabel(pathname, { "/": "home", "/api/health": "health" }));

    it("names the route it matches or none", ({ matchedRoute }) => {
      expect(matchedRoute).toBe(expectedLabel);
    });
  });

  describe.for([
    ["/api/auth/sign-in", "signin"],
    ["/api/auth/token/private@example.com", "auth"],
    ["/api/authentic", "api"],
  ] as const)("the path %s against nested wildcards", ([pathname, expectedLabel]) => {
    const it = test.extend("matchedRoute", () =>
      routeLabel(pathname, {
        "/api/*": "api",
        "/api/auth/*": "auth",
        "/api/auth/sign-in": "signin",
      }));

    it("prefers the exact path and then the longest wildcard", ({ matchedRoute }) => {
      expect(matchedRoute).toBe(expectedLabel);
    });
  });
});

describe("isRoutes", () => {
  describe.for([
    ["fixed paths with bounded labels", { "/": "home", "/api/health": "health" }, true],
    ["terminal wildcards", { "/api/*": "api", "/api/auth/*": "auth" }, true],
    ["a label that is an address", { "/": "private@example.com" }, false],
    ["a wildcard in the middle", { "/api/*/token": "bad" }, false],
    ["a double wildcard", { "/api/**": "bad" }, false],
  ] as const)("routes with %s", ([, routes, expectedValidity]) => {
    const it = test.extend("valid", () => isRoutes(routes));

    it("are accepted only when every path is fixed and every label bounded", ({ valid }) => {
      expect(valid).toBe(expectedValidity);
    });
  });
});
