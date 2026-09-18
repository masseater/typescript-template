import { Effect } from "effect";
import { HttpResponse } from "msw";
import { describe, expect, test } from "vite-plus/test";

import { annotateLogs, annotateSpan } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";
import { authorization, endpoint, otlpExportSummary } from "./otlp-fixture.ts";
import { logAt } from "./severity.ts";

const leaked = "otlp-test-value-at-least-32-characters-long";
const rejected = 404;
const requestLine = {
  duration_ms: 0,
  event: "http.server.request",
  method: "GET",
  release: "abc123",
  request_id: "22222222-2222-4222-8222-222222222222",
  route: "home",
  service: "user-server",
  span_id: "<span>",
  status: 204,
  trace_id: "<request>",
};
const requestAttributeKeys = [
  "duration_ms",
  "fiberId",
  "method",
  "request_id",
  "route",
  "service.name",
  "service.version",
  "span_id",
  "status",
  "trace_id",
];

describe("a request observed against a configured OTLP endpoint", () => {
  const it = test.extend("exportSummary", async () =>
    otlpExportSummary({ otlp: { authorization, endpoint } }));

  it("carries one trace id through the spans, the logs and the answer", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [authorization],
      exportsCarryRedaction: false,
      exportsCarrySecret: false,
      logAttributeKeys: requestAttributeKeys,
      logBodies: ["http.server.request"],
      logTraceIds: ["<request>"],
      requestTraceId: "<request>",
      severityTexts: ["Info"],
      signalCounts: [1, 1],
      structuredLines: [requestLine],
      traceTraceIds: ["<request>"],
    });
  });
});

describe("a request observed without an OTLP destination", () => {
  const it = test.extend("exportSummary", async () => otlpExportSummary({}));

  it("leaves the structured log line as the only record", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [],
      exportsCarryRedaction: false,
      exportsCarrySecret: false,
      logAttributeKeys: [],
      logBodies: [],
      logTraceIds: [],
      requestTraceId: "<request>",
      severityTexts: [],
      signalCounts: [0, 0],
      structuredLines: [requestLine],
      traceTraceIds: [],
    });
  });
});

describe("a secret an attribute carries", () => {
  const it = test.extend("exportSummary", async () =>
    otlpExportSummary({
      alongside: Effect.logError("authentication.failed", {
        cause: { AUTH_SECRET: leaked, reason: "invalid token" },
      }),
      otlp: { authorization, endpoint },
      secret: leaked,
    }));

  it("reaches neither the endpoint nor the log line", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [authorization],
      exportsCarryRedaction: true,
      exportsCarrySecret: false,
      logAttributeKeys: requestAttributeKeys,
      logBodies: ["http.server.request"],
      logTraceIds: ["<request>"],
      requestTraceId: "<request>",
      severityTexts: ["Error", "Info"],
      signalCounts: [1, 1],
      structuredLines: [
        requestLine,
        {
          cause: { AUTH_SECRET: "[redacted]", reason: "invalid token" },
          event: "authentication.failed",
          release: "abc123",
          service: "user-server",
        },
      ],
      traceTraceIds: ["<request>"],
    });
  });
});

describe("a secret an annotation or a span attribute carries", () => {
  const it = test.extend("exportSummary", async () =>
    otlpExportSummary({
      alongside: Effect.gen(function* annotated() {
        yield* annotateSpan({ "session.cookie": `template-user.session=${leaked}` });
        yield* Effect.logInfo("interview.started").pipe(
          annotateLogs({ auth_token: leaked, interview_id: "abc" }),
        );
      }),
      otlp: { authorization, endpoint },
      secret: leaked,
    }));

  it("reaches no destination", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [authorization],
      exportsCarryRedaction: true,
      exportsCarrySecret: false,
      logAttributeKeys: ["auth_token", "interview_id", ...requestAttributeKeys].toSorted(),
      logBodies: ["http.server.request", "interview.started"],
      logTraceIds: ["<request>"],
      requestTraceId: "<request>",
      severityTexts: ["Info"],
      signalCounts: [1, 1],
      structuredLines: [
        requestLine,
        {
          auth_token: "[redacted]",
          event: "interview.started",
          interview_id: "abc",
          release: "abc123",
          service: "user-server",
        },
      ],
      traceTraceIds: ["<request>"],
    });
  });
});

describe("client spans answered with a refusal and a bad request", () => {
  const it = test.extend("exportSummary", async () =>
    otlpExportSummary({
      alongside: Effect.gen(function* refused() {
        yield* logAt("Info", {
          attributes: { "http.response.status_code": httpStatus.forbidden },
          eventName: "http.client.request",
        });
        yield* logAt("Warn", {
          attributes: { "http.response.status_code": httpStatus.badRequest },
          eventName: "http.client.request",
        });
      }),
      otlp: { authorization, endpoint },
    }));

  it("reach the endpoint with the severity the status code asks for", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [authorization],
      exportsCarryRedaction: false,
      exportsCarrySecret: false,
      logAttributeKeys: ["http.response.status_code", ...requestAttributeKeys].toSorted(),
      logBodies: ["http.client.request", "http.server.request"],
      logTraceIds: ["<request>"],
      requestTraceId: "<request>",
      severityTexts: ["Info", "Warn"],
      signalCounts: [1, 1],
      structuredLines: [
        requestLine,
        {
          event: "http.client.request",
          "http.response.status_code": httpStatus.forbidden,
          release: "abc123",
          service: "user-server",
        },
        {
          event: "http.client.request",
          "http.response.status_code": httpStatus.badRequest,
          release: "abc123",
          service: "user-server",
        },
      ],
      traceTraceIds: ["<request>"],
    });
  });
});

describe("a receiver that rejects the export", () => {
  const it = test.extend("exportSummary", async () =>
    otlpExportSummary({
      otlp: { endpoint },
      respond: () => new HttpResponse(undefined, { status: rejected }),
    }));

  it("leaves a warning in the structured log", ({ exportSummary }) => {
    expect(exportSummary).toStrictEqual({
      authorizations: [""],
      exportsCarryRedaction: false,
      exportsCarrySecret: false,
      logAttributeKeys: requestAttributeKeys,
      logBodies: ["http.server.request"],
      logTraceIds: ["<request>"],
      requestTraceId: "<request>",
      severityTexts: ["Info"],
      signalCounts: [1, 1],
      structuredLines: [
        requestLine,
        {
          event: "otlp.export_failed",
          module: "OtlpTracer",
          "otlp.status": rejected,
          package: "@effect/opentelemetry",
          release: "abc123",
          service: "user-server",
        },
        {
          event: "otlp.export_failed",
          module: "OtlpLogger",
          "otlp.status": rejected,
          package: "@effect/opentelemetry",
          release: "abc123",
          service: "user-server",
        },
      ],
      traceTraceIds: ["<request>"],
    });
  });
});
