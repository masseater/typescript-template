import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Layer } from "effect";

import { httpStatus } from "./http-status.ts";
import { randomHex, spanIdBytes } from "./protocol.ts";
import { CurrentRequest, Telemetry, ingestBrowser, observeRequest } from "./server.ts";
import type { TelemetryInvalid } from "./server.ts";
import type { LogSink } from "./structured-logs.ts";
import { recordingSink } from "./testing.ts";

interface IngestInit {
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
}

const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";
const telemetryUrl = "http://localhost/api/telemetry";
const created = 201;
const noContent = 204;
const oversizedBody = 32_769;
const jsonHeaders = { "content-type": "application/json", origin: "http://localhost" };
const telemetry = Telemetry.layer({
  release: "test",
  routes: { "/": "home", "/api/telemetry": "telemetry" },
  serviceName: "user",
});

function recordedTelemetry(log: LogSink): Layer.Layer<Telemetry, TelemetryInvalid> {
  return Telemetry.layer({
    log,
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "user",
  });
}

function browserEvent(): Record<string, unknown> {
  return {
    duration: 25,
    kind: "http",
    method: "POST",
    name: "http.client.request",
    requestId: crypto.randomUUID(),
    route: "home",
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    status: created,
    traceId,
    value: 0,
  };
}

function ingestStatus(init?: IngestInit): Effect.Effect<number, never, Telemetry> {
  return ingestBrowser(new Request(telemetryUrl, init)).pipe(
    Effect.map((response) => response.status),
  );
}

function probeEvents(): string {
  const base = {
    duration: 25,
    requestId: "11111111-1111-4111-8111-111111111111",
    route: "home",
    start: Date.now(),
    traceId,
  };
  const exception = {
    ...base,
    errorType: "TypeError",
    kind: "exception",
    locations: "/assets/index-abc.js:1:234",
    method: "GET",
    name: "browser.error",
    spanId: randomHex(spanIdBytes),
    status: 0,
    value: 1,
  };
  const request = {
    ...base,
    kind: "http",
    method: "POST",
    name: "http.client.request",
    spanId,
  };
  return JSON.stringify([{ ...request, status: created, value: 0 }, exception]);
}

const runProbe = Effect.fn("runProbe")(function* runProbe() {
  const accepted = yield* ingestBrowser(
    new Request(telemetryUrl, { body: probeEvents(), headers: jsonHeaders, method: "POST" }),
  );
  yield* observeRequest(new Request("http://localhost/"), () =>
    Effect.die(new RangeError("private@example.test")),
  );
  return accepted.status;
});

describe("request wrapping", () => {
  it.effect("the real HTTP response keeps its body and headers and gains correlation headers", () =>
    Effect.gen(function* program() {
      const response = yield* observeRequest(new Request("http://localhost/?token=private"), () =>
        Effect.succeed(
          new Response("actual response", {
            headers: { "set-cookie": "session=private; HttpOnly" },
            status: created,
          }),
        ),
      );
      assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/u);
      assert.match(response.headers.get("traceparent") ?? "", /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
      const text = yield* Effect.promise(async () => response.text());
      assert.deepStrictEqual(
        { cookie: response.headers.get("set-cookie"), status: response.status, text },
        { cookie: "session=private; HttpOnly", status: created, text: "actual response" },
      );
    }).pipe(Effect.provide(telemetry)),
  );

  it.effect("handler defects become a generic 500 response without the error message", () =>
    Effect.gen(function* program() {
      const response = yield* observeRequest(new Request("http://localhost/"), () =>
        Effect.die(new Error("sensitive application error")),
      );
      assert.strictEqual(response.status, httpStatus.internalServerError);
      assert.notInclude(yield* Effect.promise(async () => response.text()), "sensitive");
    }).pipe(Effect.provide(telemetry)),
  );
});

describe("trace propagation", () => {
  it.effect(
    "browser trace parent is propagated but caller-controlled request IDs are replaced",
    () =>
      Effect.gen(function* program() {
        const incoming = new Request("http://localhost/", {
          headers: {
            traceparent: `00-${traceId}-${spanId}-01`,
            "x-request-id": "private@example.com",
          },
        });
        const response = yield* observeRequest(incoming, () =>
          Effect.gen(function* handler() {
            const context = yield* CurrentRequest;
            assert.strictEqual(context.traceId, traceId);
            assert.notStrictEqual(context.requestId, "private@example.com");
            return new Response(undefined, { status: noContent });
          }),
        );
        assert.match(response.headers.get("traceparent") ?? "", new RegExp(`^00-${traceId}-`, "u"));
      }).pipe(Effect.provide(telemetry)),
  );
});

describe("browser ingress", () => {
  it.effect("rejects non-POST and cross-origin requests", () =>
    Effect.gen(function* program() {
      assert.strictEqual(yield* ingestStatus(), httpStatus.methodNotAllowed);
      const crossOrigin = { headers: { origin: "https://evil.example" }, method: "POST" };
      assert.strictEqual(yield* ingestStatus(crossOrigin), httpStatus.forbidden);
    }).pipe(Effect.provide(telemetry)),
  );

  it.effect("rejects arbitrary bodies and excessive payloads", () =>
    Effect.gen(function* program() {
      const plain = {
        body: "x",
        headers: { ...jsonHeaders, "content-type": "text/plain" },
        method: "POST",
      };
      assert.strictEqual(yield* ingestStatus(plain), httpStatus.unsupportedMediaType);
      const oversized = { body: "x".repeat(oversizedBody), headers: jsonHeaders, method: "POST" };
      assert.strictEqual(yield* ingestStatus(oversized), httpStatus.payloadTooLarge);
      const body = JSON.stringify([{ ...browserEvent(), token: "private" }]);
      const forged = { body, headers: jsonHeaders, method: "POST" };
      assert.strictEqual(yield* ingestStatus(forged), httpStatus.badRequest);
    }).pipe(Effect.provide(telemetry)),
  );

  it.effect("accepts a resent batch without recording its events a second time", () => {
    const logs = recordingSink();
    const resend = {
      body: JSON.stringify([browserEvent()]),
      headers: jsonHeaders,
      method: "POST",
    };
    return Effect.gen(function* program() {
      const accepted = yield* ingestStatus(resend);
      const resent = yield* ingestStatus(resend);
      assert.deepStrictEqual(
        { accepted, recorded: logs.stdout.length, resent },
        { accepted: httpStatus.accepted, recorded: 1, resent: httpStatus.accepted },
      );
    }).pipe(Effect.provide(recordedTelemetry(logs.sink)));
  });
});

const noStatus = 0;
const severityByStatus = [
  [httpStatus.unauthorized, "stdout"],
  [httpStatus.forbidden, "stdout"],
  [httpStatus.notFound, "stdout"],
  [httpStatus.badRequest, "stdwarn"],
  [httpStatus.tooManyRequests, "stdwarn"],
  [httpStatus.internalServerError, "stderr"],
  [noStatus, "stderr"],
] as const;

describe("the severity of a browser client span", () => {
  for (const [status, stream] of severityByStatus) {
    it.effect(`records ${status} on ${stream}`, () => {
      const logs = recordingSink();
      const body = JSON.stringify([{ ...browserEvent(), status }]);
      return Effect.gen(function* program() {
        yield* ingestStatus({ body, headers: jsonHeaders, method: "POST" });
        assert.containSubset(logs[stream], [
          {
            event: "http.client.request",
            "http.response.status_code": status,
            service: "user-browser",
          },
        ]);
        const others = (["stderr", "stdout", "stdwarn"] as const).filter((name) => name !== stream);
        assert.deepStrictEqual(
          others.map((name) => logs[name].length),
          others.map(() => 0),
        );
      }).pipe(Effect.provide(recordedTelemetry(logs.sink)));
    });
  }
});

describe("structured log lines", () => {
  it.effect("browser events and server errors become structured log lines", () =>
    Effect.gen(function* program() {
      const logs = recordingSink();
      const status = yield* runProbe().pipe(Effect.provide(recordedTelemetry(logs.sink)));
      assert.strictEqual(status, httpStatus.accepted);
      assert.lengthOf(logs.stdout, 1);
      assert.containSubset(logs.stdout, [
        {
          event: "http.client.request",
          "http.response.status_code": created,
          release: "abc123",
          service: "user-browser",
          trace_id: traceId,
        },
      ]);
      assert.containSubset(logs.stderr, [
        {
          "browser.request_id": "11111111-1111-4111-8111-111111111111",
          "error.locations": "/assets/index-abc.js:1:234",
          "error.type": "TypeError",
          event: "browser.error",
          service: "user-browser",
        },
        { "error.type": "RangeError", event: "application.error" },
        { event: "http.server.request", status: httpStatus.internalServerError },
      ]);
      const serialized = JSON.stringify(logs.stderr);
      assert.match(
        serialized,
        /"error\.fingerprint":"[0-9a-f]{8}".*"error\.fingerprint":"[0-9a-f]{8}"/u,
      );
      assert.notInclude(serialized, "private@example.test");
    }),
  );
});
