import { describe, expect, it } from "vitest";
import { maxQueryLimit, minutesPerDay, queryPath } from "./query.ts";
import type { QueryInput } from "./query.ts";

const input = {
  command: "logs" as const,
  limit: 100,
  minutes: 15,
  service: "admin-server" as const,
};
const traceIdLength = 32;
const traceId = "a".repeat(traceIdLength);
const fixedNow = 1_800_000_000_000;
const oversizedExpressionLength = 4097;

const browserSeries = [
  ["user-browser", "metrics", "count"],
  ["user-browser", "exemplars", "bucket"],
  ["admin-browser", "metrics", "count"],
  ["admin-browser", "exemplars", "bucket"],
] as const;

function browserQuery(
  selector: Pick<QueryInput, "command" | "expression" | "service">,
): string | null {
  const path = queryPath({ ...input, ...selector }, Date.now());
  return new URL(path, "http://localhost").searchParams.get("query");
}

describe("observability read API paths", () => {
  it("log queries encode a bounded time range and trace/request filters", () => {
    expect.hasAssertions();
    const url = new URL(
      queryPath(
        {
          ...input,
          requestId: "11111111-1111-4111-8111-111111111111",
          severity: "ERROR",
          traceId,
        },
        fixedNow,
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

  it("trace and metrics queries use read APIs without interpolating IDs into arbitrary paths", () => {
    expect.hasAssertions();
    expect(queryPath({ ...input, command: "trace", traceId }, Date.now())).toBe(
      `/api/datasources/proxy/uid/tempo/api/traces/${traceId}`,
    );
    expect(() =>
      queryPath({ ...input, command: "trace", traceId: "../../admin" }, Date.now()),
    ).toThrow("trace ID");
    expect(() => queryPath({ ...input, command: "trace" }, Date.now())).toThrow("requires");
    expect(queryPath({ ...input, command: "metrics" }, Date.now())).toContain("/api/v1/query?");
    expect(queryPath({ ...input, command: "doctor" }, Date.now())).toBe("/api/datasources");
  });
});

describe("observability query guards", () => {
  it("query limits and invalid filter IDs are rejected before networking", () => {
    expect.hasAssertions();
    expect(() => queryPath({ ...input, limit: maxQueryLimit + 1 }, Date.now())).toThrow("bounds");
    expect(() => queryPath({ ...input, minutes: minutesPerDay + 1 }, Date.now())).toThrow("bounds");
    expect(() =>
      queryPath({ ...input, requestId: 'x" | line_format "private' }, Date.now()),
    ).toThrow("request ID");
  });

  it.for(browserSeries)(
    "browser %s %s queries client series and supports explicit metric selectors",
    ([service, command, series]) => {
      expect.hasAssertions();
      expect(browserQuery({ command, service })).toBe(
        `http_client_request_duration_seconds_${series}{service_name="${service}"}`,
      );
      const expression = `browser_exception_bucket{service_name="${service}"}`;
      expect(browserQuery({ command, expression, service })).toBe(expression);
      const oversized = "x".repeat(oversizedExpressionLength);
      expect(() =>
        queryPath({ ...input, command, expression: oversized, service }, Date.now()),
      ).toThrow("too long");
    },
  );
});
