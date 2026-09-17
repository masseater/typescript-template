import { expect, test } from "vitest";
import { queryPath } from "./query.ts";

const input = {
  command: "logs" as const,
  service: "admin-server" as const,
  minutes: 15,
  limit: 100,
};

test("log queries encode a bounded time range and trace/request filters", () => {
  const url = new URL(
    queryPath(
      {
        ...input,
        traceId: "a".repeat(32),
        requestId: "11111111-1111-4111-8111-111111111111",
        severity: "ERROR",
      },
      1_800_000_000_000,
    ),
    "http://localhost",
  );
  expect(url.pathname).toBe("/api/datasources/proxy/uid/loki/loki/api/v1/query_range");
  expect(url.searchParams.get("query")).toBe(
    '{service_name="admin-server"} | severity_text = "ERROR" | request_id = "11111111-1111-4111-8111-111111111111" | trace_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
  );
  expect(url.searchParams.get("end")).toBe("1800000000");
  expect(url.searchParams.get("start")).toBe("1799999100");
  expect(url.searchParams.get("limit")).toBe("100");
});

test("trace and metrics queries use read APIs without interpolating IDs into arbitrary paths", () => {
  expect(queryPath({ ...input, command: "trace", traceId: "a".repeat(32) }, Date.now())).toBe(
    `/api/datasources/proxy/uid/tempo/api/traces/${"a".repeat(32)}`,
  );
  expect(() =>
    queryPath({ ...input, command: "trace", traceId: "../../admin" }, Date.now()),
  ).toThrow("trace ID");
  expect(() => queryPath({ ...input, command: "trace" }, Date.now())).toThrow("requires");
  expect(queryPath({ ...input, command: "metrics" }, Date.now())).toContain("/api/v1/query?");
  expect(queryPath({ ...input, command: "doctor" }, Date.now())).toBe("/api/datasources");
});

test("query limits and invalid filter IDs are rejected before networking", () => {
  expect(() => queryPath({ ...input, limit: 501 }, Date.now())).toThrow("bounds");
  expect(() => queryPath({ ...input, minutes: 1441 }, Date.now())).toThrow("bounds");
  expect(() => queryPath({ ...input, requestId: 'x" | line_format "private' }, Date.now())).toThrow(
    "request ID",
  );
});

test("browser metrics and exemplars query client series and support explicit metric selectors", () => {
  for (const service of ["user-browser", "admin-browser"] as const) {
    for (const command of ["metrics", "exemplars"] as const) {
      const path = queryPath({ ...input, service, command }, Date.now());
      const query = new URL(path, "http://localhost").searchParams.get("query");
      expect(query).toBe(
        `http_client_request_duration_seconds_${command === "metrics" ? "count" : "bucket"}{service_name="${service}"}`,
      );
      const expression = `browser_exception_bucket{service_name="${service}"}`;
      expect(
        new URL(
          queryPath({ ...input, service, command, expression }, Date.now()),
          "http://localhost",
        ).searchParams.get("query"),
      ).toBe(expression);
      expect(() =>
        queryPath({ ...input, service, command, expression: "x".repeat(4097) }, Date.now()),
      ).toThrow("too long");
    }
  }
});
