import "@repo/dont-review-it/vitest/parsed-fields";
import { Effect, Layer } from "effect";
import { attemptAsync } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import {
  CurrentRequest,
  RequestEntropy,
  Telemetry,
  ingestBrowser,
  observeRequest,
} from "./server.ts";
import { fixedSpans, recordingSink } from "./testing.ts";

const fixedEntropy = Layer.succeed(RequestEntropy, {
  epochMilliseconds: () => 1_800_000_000_000,
  monotonicMilliseconds: () => 0,
  requestId: () => "22222222-2222-4222-8222-222222222222",
});

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
    const it = test.extend("observedResponse", async () =>
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
            Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
          ),
          Effect.provide(fixedEntropy),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("keeps the body, status and headers and adds the correlation headers", async ({
      observedResponse,
    }) => {
      await expect(observedResponse).toHaveParsedFields({
        status: 201,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "set-cookie": "session=private; HttpOnly",
          ...correlationHeaders,
        },
        body: "actual response",
      });
    });
  });

  describe("a request whose handler dies", () => {
    const it = test.extend("observedResponse", async () =>
      Effect.runPromise(
        observeRequest(new Request(testOrigin), () =>
          Effect.die(new Error("sensitive application error")),
        ).pipe(
          Effect.provide(
            Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
          ),
          Effect.provide(fixedEntropy),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("answers a generic 500 that leaves the error message out", async ({ observedResponse }) => {
      await expect(observedResponse).toHaveParsedFields({
        status: 500,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          ...correlationHeaders,
        },
        body: { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      });
    });
  });

  describe("a request carrying a browser traceparent and a request id of its own", () => {
    const it = test.extend("observedResponse", async () =>
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
            Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
          ),
          Effect.provide(fixedEntropy),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("continues the browser trace under a request id of its own", async ({
      observedResponse,
    }) => {
      await expect(observedResponse).toHaveParsedFields({
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
      });
    });
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
        body: JSON.stringify([{ ...requestEvent, token: "private" }]),
        headers: { "content-type": "application/json", origin: "http://localhost" },
        method: "POST",
      },
      400,
      { "cache-control": "no-store" },
    ],
  ] as const)("%s", ([, requestInit, expectedStatus, expectedHeaders]) => {
    const it = test.extend("ingressResponse", async () =>
      Effect.runPromise(
        ingestBrowser(new Request(new URL("/api/telemetry", testOrigin), requestInit)).pipe(
          Effect.provide(
            Telemetry.layer({
              release: "test",
              routes: { "/": "home", "/api/telemetry": "telemetry" },
              serviceName: "user",
            }),
          ),
          Effect.provide(fixedEntropy),
          Effect.withTracer(fixedSpans),
        ),
      ));

    it("is refused without a body", async ({ ingressResponse }) => {
      await expect(ingressResponse).toHaveParsedFields({
        status: expectedStatus,
        headers: expectedHeaders,
        body: null,
      });
    });
  });

  describe.for([
    [401, "stdout", "b1b1b1b1b1b1b1b1"],
    [403, "stdout", "b2b2b2b2b2b2b2b2"],
    [404, "stdout", "b3b3b3b3b3b3b3b3"],
    [400, "stdwarn", "b4b4b4b4b4b4b4b4"],
    [429, "stdwarn", "b5b5b5b5b5b5b5b5"],
    [500, "stderr", "b6b6b6b6b6b6b6b6"],
    [0, "stderr", "b7b7b7b7b7b7b7b7"],
  ] as const)("a browser client span answered with %s", ([status, stream, spanId]) => {
    const it = test.extend("recordedStreams", async () => {
      const recorded = recordingSink();
      await Effect.runPromise(
        ingestBrowser(
          new Request(new URL("/api/telemetry", testOrigin), {
            body: JSON.stringify([{ ...requestEvent, spanId, status }]),
            headers: { "content-type": "application/json", origin: "http://localhost" },
            method: "POST",
          }),
        ).pipe(
          Effect.provide(
            Telemetry.layer({
              log: recorded.sink,
              release: "test",
              routes: { "/": "home", "/api/telemetry": "telemetry" },
              serviceName: "user",
            }),
          ),
          Effect.provide(fixedEntropy),
          Effect.withTracer(fixedSpans),
        ),
      );
      return { stderr: recorded.stderr, stdout: recorded.stdout, stdwarn: recorded.stdwarn };
    });

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
            "http.response.status_code": status,
          },
        ],
      });
    });
  });

  describe("the same batch posted twice", () => {
    const it = test.extend("resentBatch", async () => {
      const recorded = recordingSink();
      const resend = (): Promise<Response> =>
        Effect.runPromise(
          ingestBrowser(
            new Request(new URL("/api/telemetry", testOrigin), {
              body: JSON.stringify([requestEvent]),
              headers: { "content-type": "application/json", origin: "http://localhost" },
              method: "POST",
            }),
          ).pipe(
            Effect.provide(
              Telemetry.layer({
                log: recorded.sink,
                release: "test",
                routes: { "/": "home", "/api/telemetry": "telemetry" },
                serviceName: "user",
              }),
            ),
            Effect.provide(fixedEntropy),
            Effect.withTracer(fixedSpans),
          ),
        );
      const accepted = await resend();
      const resent = await resend();
      return {
        accepted: accepted.status,
        recorded: recorded.stdout.length,
        resent: resent.status,
      };
    });

    it("is accepted again and records its events once", ({ resentBatch }) => {
      expect(resentBatch).toStrictEqual({ accepted: 202, recorded: 1, resent: 202 });
    });
  });
});

describe("browser events followed by a failing request", () => {
  const it = test
    .extend("progressLines", () => vi.fn<(line: string) => void>())
    .extend("failureLines", () => vi.fn<(line: string) => void>())
    .extend("warningLines", () => vi.fn<(line: string) => void>())
    .extend(
      "serverFailure",
      { auto: true },
      async ({ failureLines, progressLines, warningLines }) => {
        const telemetry = Telemetry.layer({
          log: { error: failureLines, info: progressLines, warn: warningLines },
          release: "abc123",
          routes: { "/": "home" },
          serviceName: "user",
        });
        const [failure] = await attemptAsync(async () =>
          Effect.runPromise(
            Effect.gen(function* probe() {
              yield* ingestBrowser(
                new Request(new URL("/api/telemetry", testOrigin), {
                  body: JSON.stringify([
                    requestEvent,
                    {
                      ...requestEvent,
                      errorType: "TypeError",
                      kind: "exception",
                      locations: "/assets/index-abc.js:1:234",
                      method: "GET",
                      name: "browser.error",
                      status: 0,
                      value: 1,
                    },
                  ]),
                  headers: { "content-type": "application/json", origin: "http://localhost" },
                  method: "POST",
                }),
              );
              yield* observeRequest(new Request(testOrigin), () =>
                Effect.die(
                  new (class extends RangeError {
                    public override readonly stack =
                      "RangeError: private@example.test\n at handle (/assets/app-abc.js:7:11)";
                  })("private@example.test"),
                ),
              );
            }).pipe(
              Effect.provide(telemetry),
              Effect.provide(fixedEntropy),
              Effect.withTracer(fixedSpans),
            ),
          ),
        );
        return failure;
      },
    );

  it("logs the request event as a progress line", ({ progressLines }) => {
    expect(progressLines).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        event: "http.client.request",
        release: "abc123",
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
      }),
    );
  });

  it("logs the browser exception without its message", ({ failureLines }) => {
    expect(failureLines).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        event: "browser.error",
        release: "abc123",
        service: "user-browser",
        duration_ms: 25,
        "http.route": "home",
        measurement_value: 1,
        request_id: "11111111-1111-4111-8111-111111111111",
        span_id: "bbbbbbbbbbbbbbbb",
        start: "2027-01-15T08:00:00.000Z",
        "telemetry.source": "untrusted-browser",
        trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "error.fingerprint": "17494eb0",
        "error.locations": "/assets/index-abc.js:1:234",
        "error.type": "TypeError",
      }),
    );
  });

  it("logs the server failure without its message", ({ failureLines }) => {
    expect(failureLines).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        event: "application.error",
        release: "abc123",
        service: "user-server",
        request_id: "22222222-2222-4222-8222-222222222222",
        span_id: "c".repeat(16),
        trace_id: "c".repeat(32),
        "error.fingerprint": "ea495fdd",
        "error.locations": "/assets/app-abc.js:7:11",
        "error.type": "RangeError",
      }),
    );
  });

  it("logs the failed request as the last line", ({ failureLines }) => {
    expect(failureLines).toHaveBeenLastCalledWith(
      JSON.stringify({
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
      }),
    );
  });
});
