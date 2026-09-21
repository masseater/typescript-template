import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Cause, Effect, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { annotateSpan, withSpan } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";
import { Telemetry, flushTelemetry, observeRequest } from "./server.ts";
import { logAt, logCause } from "./severity.ts";

import type { OtlpDestination } from "./otlp.ts";

interface Observed {
  readonly authorization: readonly string[];
  readonly lines: readonly unknown[];
  readonly logs: readonly unknown[];
  readonly traceparent: string;
  readonly traces: readonly unknown[];
}

const endpoint = "https://otlp.example.test";
const authorization = "Bearer otlp-test-token";
const leaked = "otlp-test-value-at-least-32-characters-long";
const noContent = 204;
const rejected = 404;
const exportedTraceIds = /"traceId":"(?<traceId>[0-9a-f]{32})"/gu;
const traceparentTraceId = /^00-(?<traceId>[0-9a-f]{32})-[0-9a-f]{16}-01$/u;
const traceIdPattern = /^[0-9a-f]{32}$/u;

const listening: { current?: ReturnType<typeof setupNetwork> } = {};

const network = function network(): ReturnType<typeof setupNetwork> {
  const { current } = listening;
  if (current !== undefined) {
    return current;
  }
  const started = setupNetwork();
  started.configure({ onUnhandledFrame: "error" });
  started.enable();
  listening.current = started;
  return started;
};

const accepted = function accepted(): Response {
  return HttpResponse.json({});
};

const observed = function observed(
  otlp?: OtlpDestination,
  responding: () => Response = accepted,
  alongside: Effect.Effect<void> = Effect.void,
): Effect.Effect<Observed> {
  const seen = { authorization: [] as string[], logs: [] as unknown[], traces: [] as unknown[] };
  const lines: unknown[] = [];
  function collect(signal: "logs" | "traces"): Parameters<typeof http.post>[1] {
    return ({ request }) =>
      Effect.runPromise(
        Effect.gen(function* collectRequest() {
          seen.authorization.push(request.headers.get("authorization") ?? "");
          seen[signal].push(yield* Effect.promise(() => request.json()));
          return responding();
        }),
      );
  }
  function record(line: string): void {
    lines.push(
      Effect.runSync(
        Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(line).pipe(Effect.orDie),
      ),
    );
  }
  const telemetry = Telemetry.layer({
    log: { error: record, info: record, warn: record },
    otlp,
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "service-member",
  });
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      network().use(
        http.post(`${endpoint}/v1/traces`, collect("traces")),
        http.post(`${endpoint}/v1/logs`, collect("logs")),
      );
    }),
    () =>
      Effect.gen(function* observedProgram() {
        const response = yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: noContent })),
        );
        yield* alongside;
        yield* flushTelemetry;
        return { ...seen, lines, traceparent: response.headers.get("traceparent") ?? "" };
      }).pipe(Effect.provide(telemetry), Effect.orDie),
    () =>
      Effect.sync(() => {
        network().resetHandlers();
      }),
  );
};

const traceIds = function traceIds(payload: readonly unknown[]): readonly string[] {
  const matches = Effect.runSync(
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(payload),
  ).matchAll(exportedTraceIds);
  return Array.from(matches, (match) => match.groups?.["traceId"] ?? "");
};

const assertLogAttributes = function assertLogAttributes(logs: readonly unknown[]): void {
  const record = Effect.runSync(Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(logs));
  for (const attribute of ["duration_ms", "request_id", "route", "status"]) {
    assert.include(record, `{"key":"${attribute}","value":`);
  }
  assert.include(record, '"body":{"stringValue":"http.server.request"}');
};

const requestTraceId = function requestTraceId(traceparent: string): string {
  return traceparentTraceId.exec(traceparent)?.groups?.["traceId"] ?? "";
};

it.effect("spans, logs and the response share one trace id at the OTLP endpoint", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed({ authorization, endpoint });
    const traceId = requestTraceId(telemetry.traceparent);
    assert.match(traceId, traceIdPattern);
    assert.deepStrictEqual(traceIds(telemetry.traces), [traceId]);
    assert.deepStrictEqual(traceIds(telemetry.logs), [traceId]);
    assert.containSubset(telemetry.lines, [
      { event: "http.server.request", service: "service-member-server", trace_id: traceId },
    ]);
    assert.deepStrictEqual(new Set(telemetry.authorization), new Set([authorization]));
    assertLogAttributes(telemetry.logs);
  }),
);

it.effect("no OTLP destination leaves the structured log line as the only record", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed();
    assert.deepStrictEqual([telemetry.logs.length, telemetry.traces.length], [0, 0]);
    assert.containSubset(telemetry.lines, [
      { event: "http.server.request", trace_id: requestTraceId(telemetry.traceparent) },
    ]);
  }),
);

it.effect("a secret an attribute carries reaches neither the endpoint nor the log line", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed(
      { authorization, endpoint },
      accepted,
      logAt("Error", {
        attributes: {
          AUTH_SECRET: leaked,
          reason: "invalid token",
        },
        eventName: "authentication.failed",
      }),
    );
    const exported = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      telemetry.logs,
    );
    assert.notInclude(exported, leaked);
    assert.include(exported, "authentication.failed");
    assert.include(exported, "[redacted]");
    assert.containSubset(telemetry.lines, [{ AUTH_SECRET: "[redacted]", reason: "invalid token" }]);
  }),
);

const refused = Effect.gen(function* refused() {
  yield* logAt("Info", {
    attributes: {
      "http.response.status_code": httpStatus.forbidden,
    },
    eventName: "http.client.request",
  });
  yield* logAt("Warn", {
    attributes: {
      "http.response.status_code": httpStatus.badRequest,
    },
    eventName: "http.client.request",
  });
});

const annotated = Effect.gen(function* annotated() {
  yield* annotateSpan({ "session.cookie": `template-user.session=${leaked}` });
  yield* logAt("Info", {
    attributes: { auth_token: leaked, interview_id: "abc" },
    eventName: "interview.started",
  });
});

const spanned = Effect.void.pipe(
  withSpan("interview.complete", {
    attributes: { auth_token: leaked, interview_id: "abc" },
  }),
);

it.effect("a secret an annotation or a span attribute carries reaches no destination", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed({ authorization, endpoint }, accepted, annotated);
    const exported = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
      telemetry.logs,
      telemetry.traces,
    ]);
    assert.notInclude(exported, leaked);
    assert.include(exported, "[redacted]");
    assert.include(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(telemetry.logs),
      '{"key":"interview_id","value":',
    );
    assert.containSubset(telemetry.lines, [{ auth_token: "[redacted]", interview_id: "abc" }]);
  }),
);

it.effect("a secret withSpan attributes carry reaches no destination", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed({ authorization, endpoint }, accepted, spanned);
    const exported = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      telemetry.traces,
    );
    assert.notInclude(exported, leaked);
    assert.include(exported, "[redacted]");
    assert.include(exported, '{"key":"interview_id","value":');
  }),
);

it.effect("the endpoint receives the severity the status code asks for", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed({ authorization, endpoint }, accepted, refused);
    const record = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      telemetry.logs,
    );
    assert.include(record, '"severityText":"Info"');
    assert.include(record, '"severityText":"Warn"');
    assert.notInclude(record, '"severityText":"Error"');
  }),
);

it.effect("a secret the cause of a failure carries reaches no destination", () =>
  Effect.gen(function* program() {
    const failing = logCause({
      cause: Cause.fail(new Error(`no such table: jwks (AUTH_SECRET=${leaked})`)),
      eventName: "application.error",
    });
    const telemetry = yield* observed({ authorization, endpoint }, accepted, failing);
    const exported = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      telemetry.logs,
    );
    assert.notInclude(exported, leaked);
    assert.notInclude(exported, '"key":"log.error"');
    assert.include(exported, "no such table: jwks");
  }),
);

it.effect("a receiver that rejects the export leaves a warning in the structured log", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed(
      { endpoint },
      () => new HttpResponse(undefined, { status: rejected }),
    );
    assert.containSubset(telemetry.lines, [
      { event: "otlp.export_failed", "otlp.status": rejected },
    ]);
  }),
);
