import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assert, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CurrentRequest, Telemetry, ingestBrowser, observeRequest } from "./server.ts";

const telemetry = Telemetry.layer({
  serviceName: "user",
  release: "test",
  routes: { "/": "home", "/api/telemetry": "telemetry" },
});

it.effect("the real HTTP response keeps its body and headers and gains correlation headers", () =>
  Effect.gen(function* () {
    const response = yield* observeRequest(new Request("http://localhost/?token=private"), () =>
      Effect.succeed(
        new Response("actual response", {
          status: 201,
          headers: { "set-cookie": "session=private; HttpOnly" },
        }),
      ),
    );
    assert.strictEqual(response.status, 201);
    assert.strictEqual(yield* Effect.promise(() => response.text()), "actual response");
    assert.strictEqual(response.headers.get("set-cookie"), "session=private; HttpOnly");
    assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
    assert.match(response.headers.get("traceparent") ?? "", /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  }).pipe(Effect.provide(telemetry)),
);

it.effect("handler defects become a generic 500 response without the error message", () =>
  Effect.gen(function* () {
    const response = yield* observeRequest(new Request("http://localhost/"), () =>
      Effect.die(new Error("sensitive application error")),
    );
    assert.strictEqual(response.status, 500);
    assert.notInclude(yield* Effect.promise(() => response.text()), "sensitive");
  }).pipe(Effect.provide(telemetry)),
);

it.effect("browser trace parent is propagated but caller-controlled request IDs are replaced", () =>
  Effect.gen(function* () {
    const response = yield* observeRequest(
      new Request("http://localhost/", {
        headers: {
          traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
          "x-request-id": "private@example.com",
        },
      }),
      () =>
        Effect.gen(function* () {
          const context = yield* CurrentRequest;
          assert.strictEqual(context.traceId, "a".repeat(32));
          assert.notStrictEqual(context.requestId, "private@example.com");
          return new Response(null, { status: 204 });
        }),
    );
    assert.match(response.headers.get("traceparent") ?? "", /^00-a{32}-/);
  }).pipe(Effect.provide(telemetry)),
);

it.effect(
  "ingress rejects cross-origin, arbitrary bodies, excessive payloads and non-POST requests",
  () =>
    Effect.gen(function* () {
      const url = "http://localhost/api/telemetry";
      const status = (init?: RequestInit) =>
        ingestBrowser(new Request(url, init)).pipe(Effect.map((response) => response.status));
      const json = { origin: "http://localhost", "content-type": "application/json" };
      assert.strictEqual(yield* status(), 405);
      assert.strictEqual(
        yield* status({ method: "POST", headers: { origin: "https://evil.example" } }),
        403,
      );
      assert.strictEqual(
        yield* status({
          method: "POST",
          headers: { origin: "http://localhost", "content-type": "text/plain" },
          body: "x",
        }),
        415,
      );
      assert.strictEqual(
        yield* status({ method: "POST", headers: json, body: "x".repeat(32769) }),
        413,
      );
      assert.strictEqual(
        yield* status({
          method: "POST",
          headers: json,
          body: JSON.stringify([
            {
              kind: "http",
              route: "home",
              start: Date.now(),
              duration: 25,
              status: 201,
              method: "POST",
              name: "http.client.request",
              value: 0,
              traceId: "a".repeat(32),
              spanId: "b".repeat(16),
              requestId: crypto.randomUUID(),
              token: "private",
            },
          ]),
        }),
        400,
      );
    }).pipe(Effect.provide(telemetry)),
);

const probe = `
import { Effect } from "effect";
import { Telemetry, ingestBrowser, observeRequest } from "./src/server.ts";
const base = {
  route: "home",
  start: Date.now(),
  duration: 25,
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
  requestId: "11111111-1111-4111-8111-111111111111",
};
const program = Effect.gen(function* () {
  const response = yield* ingestBrowser(
    new Request("http://localhost/api/telemetry", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify([
        { ...base, kind: "http", status: 201, method: "POST", name: "http.client.request", value: 0 },
        {
          ...base,
          kind: "exception",
          status: 0,
          method: "GET",
          name: "browser.error",
          value: 1,
          errorType: "TypeError",
          locations: "/assets/index-abc.js:1:234",
        },
      ]),
    }),
  );
  yield* observeRequest(new Request("http://localhost/"), () =>
    Effect.die(new RangeError("private@example.test")),
  );
  console.info(JSON.stringify({ event: "probe.done", status: response.status }));
}).pipe(
  Effect.provide(Telemetry.layer({ serviceName: "user", release: "abc123", routes: { "/": "home" } })),
);
await Effect.runPromise(program);
`;

const lines = (output: string): unknown[] =>
  output
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));

it.effect("browser events and server errors become structured log lines", () =>
  Effect.gen(function* () {
    const result = yield* Effect.promise(() =>
      promisify(execFile)(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        timeout: 20_000,
      }),
    );
    expect(lines(result.stdout)).toEqual([
      expect.objectContaining({
        event: "http.client.request",
        service: "user-browser",
        release: "abc123",
        trace_id: "a".repeat(32),
        "http.response.status_code": 201,
      }),
      { event: "probe.done", status: 202 },
    ]);
    const stderr = lines(result.stderr);
    expect(stderr).toEqual([
      expect.objectContaining({
        event: "browser.error",
        service: "user-browser",
        request_id: "11111111-1111-4111-8111-111111111111",
        "error.type": "TypeError",
        "error.locations": "/assets/index-abc.js:1:234",
      }),
      expect.objectContaining({
        event: "application.error",
        service: "user-server",
        release: "abc123",
        "error.type": "RangeError",
      }),
      expect.objectContaining({
        event: "http.server.request",
        status: 500,
        release: "abc123",
      }),
    ]);
    expect(JSON.stringify(stderr)).toMatch(
      /"error\.fingerprint":"[0-9a-f]{8}".*"error\.fingerprint":"[0-9a-f]{8}"/,
    );
    assert.notInclude(result.stderr, "private@example.test");
  }),
);
