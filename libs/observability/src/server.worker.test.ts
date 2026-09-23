import { Effect, Layer, Option, Schema, Tracer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { RequestEntropy } from "./request-span.ts";
import { CurrentRequest, Telemetry, ingestBrowser, observeRequest } from "./server.ts";
import { recordingSink } from "./testing.ts";

const fixedNow = 1_800_000_000_000;

class FixedSpan extends Tracer.NativeSpan {
  public override readonly spanId: string = "c".repeat(16);
  public override readonly traceId: string =
    Option.getOrUndefined(this.parent)?.traceId ?? "c".repeat(32);
}

const fixedSpans = Tracer.make({ span: (spanOptions) => new FixedSpan(spanOptions) });
const clockEntropy = RequestEntropy.defaultValue();

const fixedEntropy = Layer.merge(
  Layer.succeed(RequestEntropy, {
    epochMilliseconds: () => clockEntropy.epochMilliseconds(),
    monotonicMilliseconds: () => clockEntropy.monotonicMilliseconds(),
    requestId: () => "22222222-2222-4222-8222-222222222222",
  }),
  Layer.effectDiscard(TestClock.setTime(fixedNow)).pipe(Layer.provideMerge(TestClock.layer())),
);

const testOrigin = new URL("http://localhost");

const correlationHeaders = {
  traceparent: `00-${"c".repeat(32)}-${"c".repeat(16)}-01`,
  "x-request-id": "22222222-2222-4222-8222-222222222222",
};

const requestEvent = {
  duration: 25,
  kind: "http",
  method: "POST",
  name: "http.client.request",
  requestId: "11111111-1111-4111-8111-111111111111",
  route: "home",
  spanId: "bbbbbbbbbbbbbbbb",
  start: 1_800_000_000_000,
  status: 201,
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  value: 0,
};

describe("observeRequest", () => {
  describe("a request whose handler answers", () => {
    const it = test.extend("observedResponse", () =>
      Effect.runPromise(
        observeRequest(new Request(new URL("/?token=private", testOrigin)), () =>
          Effect.succeed(
            new Response("actual response", {
              headers: { "set-cookie": "session=private; HttpOnly" },
              status: 201,
            }),
          ),
        ).pipe(
          Effect.provide(
            Layer.merge(
              Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
              fixedEntropy,
            ),
          ),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("keeps the body, status and headers and adds the correlation headers", ({
      observedResponse,
    }) =>
      expect(observedResponse).toHaveParsedFields({
        status: 201,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "set-cookie": "session=private; HttpOnly",
          ...correlationHeaders,
        },
        body: "actual response",
      }));
  });

  describe("a request whose handler dies", () => {
    const it = test.extend("observedResponse", () =>
      Effect.runPromise(
        observeRequest(new Request(testOrigin), () =>
          Effect.die(new Error("sensitive application error")),
        ).pipe(
          Effect.provide(
            Layer.merge(
              Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
              fixedEntropy,
            ),
          ),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("answers a generic 500 that leaves the error message out", ({ observedResponse }) =>
      expect(observedResponse).toHaveParsedFields({
        status: 500,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          ...correlationHeaders,
        },
        body: { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      }));
  });

  describe("a request carrying a browser traceparent and a request id of its own", () => {
    const it = test.extend("observedResponse", () =>
      Effect.runPromise(
        observeRequest(
          new Request(testOrigin, {
            headers: {
              traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
              "x-request-id": "private@example.com",
            },
          }),
          () =>
            Effect.gen(function* echoContext() {
              return Response.json(yield* CurrentRequest);
            }),
        ).pipe(
          Effect.provide(
            Layer.merge(
              Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
              fixedEntropy,
            ),
          ),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("continues the browser trace under a request id of its own", ({ observedResponse }) =>
      expect(observedResponse).toHaveParsedFields({
        status: 200,
        headers: {
          "content-type": "application/json",
          traceparent: `00-${"a".repeat(32)}-${"c".repeat(16)}-01`,
          "x-request-id": "22222222-2222-4222-8222-222222222222",
        },
        body: {
          requestId: "22222222-2222-4222-8222-222222222222",
          spanId: "c".repeat(16),
          traceId: "a".repeat(32),
          traceparent: `00-${"a".repeat(32)}-${"c".repeat(16)}-01`,
        },
      }));
  });
});

describe("ingestBrowser", () => {
  describe.for([
    ["a GET", {}, 405, { allow: "POST", "cache-control": "no-store" }],
    [
      "a POST from another origin",
      { headers: { origin: "https://evil.example" }, method: "POST" },
      403,
      { "cache-control": "no-store" },
    ],
    [
      "a POST that is not JSON",
      {
        body: "x",
        headers: { "content-type": "text/plain", origin: "http://localhost" },
        method: "POST",
      },
      415,
      { "cache-control": "no-store" },
    ],
    [
      "a POST over the size limit",
      {
        body: "x".repeat(32_769),
        headers: { "content-type": "application/json", origin: "http://localhost" },
        method: "POST",
      },
      413,
      { "cache-control": "no-store" },
    ],
    [
      "a POST carrying a field the schema does not know",
      {
        body: Effect.runSync(
          Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
            { ...requestEvent, token: "private" },
          ]),
        ),
        headers: { "content-type": "application/json", origin: "http://localhost" },
        method: "POST",
      },
      400,
      { "cache-control": "no-store" },
    ],
  ] as const)("%s", ([, requestInit, expectedStatus, expectedHeaders]) => {
    const it = test.extend("ingressResponse", () =>
      Effect.runPromise(
        ingestBrowser(new Request(new URL("/api/telemetry", testOrigin), requestInit)).pipe(
          Effect.provide(
            Layer.merge(
              Telemetry.layer({
                release: "test",
                routes: { "/": "home", "/api/telemetry": "telemetry" },
                serviceName: "user",
              }),
              fixedEntropy,
            ),
          ),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("is refused without a body", ({ ingressResponse }) =>
      expect(ingressResponse).toHaveParsedFields({
        status: expectedStatus,
        headers: expectedHeaders,
        body: null,
      }));
  });

  describe.for([
    [401, "stdout", "1111111111111111"],
    [403, "stdout", "2222222222222222"],
    [404, "stdout", "3333333333333333"],
    [400, "stdwarn", "4444444444444444"],
    [429, "stdwarn", "5555555555555555"],
    [500, "stderr", "6666666666666666"],
    [0, "stderr", "7777777777777777"],
  ] as const)("a browser client span answered with %s", ([answeredStatus, stream, spanId]) => {
    const it = test.extend("recordedStreams", () =>
      Effect.runPromise(
        Effect.gen(function* recordLogs() {
          const logs = recordingSink();
          yield* ingestBrowser(
            new Request(new URL("/api/telemetry", testOrigin), {
              body: Effect.runSync(
                Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
                  { ...requestEvent, spanId, status: answeredStatus },
                ]),
              ),
              headers: { "content-type": "application/json", origin: "http://localhost" },
              method: "POST",
            }),
          ).pipe(
            Effect.provide(
              Layer.merge(
                Telemetry.layer({
                  log: logs.sink,
                  release: "test",
                  routes: { "/": "home", "/api/telemetry": "telemetry" },
                  serviceName: "user",
                }),
                fixedEntropy,
              ),
            ),
            Effect.withTracer(fixedSpans),
            Effect.asVoid,
          );
          return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
        }),
      ));

    it(`records the span on ${stream} and leaves the other streams empty`, ({
      recordedStreams,
    }) => {
      expect(recordedStreams).toStrictEqual({
        stderr: [],
        stdout: [],
        stdwarn: [],
        [stream]: [
          {
            event: "http.client.request",
            release: "test",
            service: "user-browser",
            duration_ms: 25,
            "http.route": "home",
            measurement_value: 0,
            request_id: "11111111-1111-4111-8111-111111111111",
            span_id: spanId,
            start: "2027-01-15T08:00:00.000Z",
            "telemetry.source": "untrusted-browser",
            trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "http.request.method": "POST",
            "http.response.status_code": answeredStatus,
          },
        ],
      });
    });
  });

  describe("the same batch posted twice", () => {
    const it = test.extend("reportedLogs", () =>
      Effect.runPromise(
        Effect.gen(function* recordLogs() {
          const logs = recordingSink();
          const resend = ingestBrowser(
            new Request(new URL("/api/telemetry", testOrigin), {
              body: Effect.runSync(
                Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([requestEvent]),
              ),
              headers: { "content-type": "application/json", origin: "http://localhost" },
              method: "POST",
            }),
          ).pipe(
            Effect.provide(
              Layer.merge(
                Telemetry.layer({
                  log: logs.sink,
                  release: "test",
                  routes: { "/": "home", "/api/telemetry": "telemetry" },
                  serviceName: "user",
                }),
                fixedEntropy,
              ),
            ),
            Effect.withTracer(fixedSpans),
          );
          yield* Effect.andThen(resend, resend);
          return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
        }),
      ));

    it("records the events of the batch once", ({ reportedLogs }) => {
      expect(reportedLogs).toStrictEqual({
        stderr: [],
        stdout: [
          {
            event: "http.client.request",
            release: "test",
            service: "user-browser",
            duration_ms: 25,
            "http.route": "home",
            measurement_value: 0,
            request_id: "11111111-1111-4111-8111-111111111111",
            span_id: "bbbbbbbbbbbbbbbb",
            start: "2027-01-15T08:00:00.000Z",
            "telemetry.source": "untrusted-browser",
            trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "http.request.method": "POST",
            "http.response.status_code": 201,
          },
        ],
        stdwarn: [],
      });
    });
  });
});

describe("browser events followed by a failing request", () => {
  const it = test.extend("reportedLogs", () =>
    Effect.runPromise(
      Effect.gen(function* recordLogs() {
        const logs = recordingSink();
        yield* Effect.gen(function* probe() {
          yield* ingestBrowser(
            new Request(new URL("/api/telemetry", testOrigin), {
              body: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
                { ...requestEvent, spanId: "8888888888888888" },
                {
                  ...requestEvent,
                  errorType: "TypeError",
                  kind: "exception",
                  locations: "/assets/index-abc.js:1:234",
                  method: "GET",
                  name: "browser.error",
                  spanId: "9999999999999999",
                  status: 0,
                  value: 1,
                },
              ]).pipe(Effect.orDie),
              headers: { "content-type": "application/json", origin: "http://localhost" },
              method: "POST",
            }),
          );
          yield* observeRequest(new Request(testOrigin), () =>
            Effect.die(
              Object.create(RangeError.prototype, {
                message: { value: "private@example.test" },
                stack: {
                  value: "RangeError: private@example.test\n at handle (/assets/app-abc.js:7:11)",
                },
              }),
            ),
          );
        }).pipe(
          Effect.provide(
            Layer.merge(
              Telemetry.layer({
                log: logs.sink,
                release: "abc123",
                routes: { "/": "home" },
                serviceName: "user",
              }),
              fixedEntropy,
            ),
          ),
          Effect.withTracer(fixedSpans),
          Effect.asVoid,
        );
        return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
      }),
    ));

  it("keeps the secrets out of every line it writes", ({ reportedLogs }) => {
    expect(reportedLogs).toStrictEqual({
      stderr: [
        {
          event: "browser.error",
          release: "abc123",
          service: "user-browser",
          duration_ms: 25,
          "http.route": "home",
          measurement_value: 1,
          request_id: "11111111-1111-4111-8111-111111111111",
          span_id: "9999999999999999",
          start: "2027-01-15T08:00:00.000Z",
          "telemetry.source": "untrusted-browser",
          trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "error.fingerprint": "17494eb0",
          "error.locations": "/assets/index-abc.js:1:234",
          "error.type": "TypeError",
        },
        {
          event: "application.error",
          release: "abc123",
          service: "user-server",
          request_id: "22222222-2222-4222-8222-222222222222",
          span_id: "c".repeat(16),
          trace_id: "c".repeat(32),
          "error.fingerprint": "ea495fdd",
          "error.locations": "/assets/app-abc.js:7:11",
          "error.type": "RangeError",
        },
        {
          event: "http.server.request",
          release: "abc123",
          service: "user-server",
          request_id: "22222222-2222-4222-8222-222222222222",
          span_id: "c".repeat(16),
          trace_id: "c".repeat(32),
          duration_ms: 0,
          method: "GET",
          route: "home",
          status: 500,
        },
      ],
      stdout: [
        {
          event: "http.client.request",
          release: "abc123",
          service: "user-browser",
          duration_ms: 25,
          "http.route": "home",
          measurement_value: 0,
          request_id: "11111111-1111-4111-8111-111111111111",
          span_id: "8888888888888888",
          start: "2027-01-15T08:00:00.000Z",
          "telemetry.source": "untrusted-browser",
          trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "http.request.method": "POST",
          "http.response.status_code": 201,
        },
      ],
      stdwarn: [],
    });
  });
});
