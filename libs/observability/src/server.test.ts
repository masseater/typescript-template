import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { createInstrumentation } from "./server.ts";

const setup = () =>
  createInstrumentation({
    serviceName: "user",
    release: "test",
    routes: { "/": "home", "/api/telemetry": "telemetry" },
  });
const browserEvent = () => ({
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
});

test("the real HTTP response keeps its body and headers and gains correlation headers", async () => {
  const response = await setup().wrapRequest(
    new Request("http://localhost/?token=private"),
    () =>
      new Response("actual response", {
        status: 201,
        headers: { "set-cookie": "session=private; HttpOnly" },
      }),
  );
  expect(response.status).toBe(201);
  expect(await response.text()).toBe("actual response");
  expect(response.headers.get("set-cookie")).toBe("session=private; HttpOnly");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
});

test("handler exceptions are rethrown unchanged", async () => {
  const failure = new Error("sensitive application error");
  await expect(
    setup().wrapRequest(new Request("http://localhost/"), () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
});

test("browser trace parent is propagated but caller-controlled request IDs are replaced", async () => {
  const response = await setup().wrapRequest(
    new Request("http://localhost/", {
      headers: {
        traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
        "x-request-id": "private@example.com",
      },
    }),
    (_request, context) => {
      expect(context.traceId).toBe("a".repeat(32));
      expect(context.requestId).not.toBe("private@example.com");
      return new Response(null, { status: 204 });
    },
  );
  expect(response.headers.get("traceparent")).toMatch(/^00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-/);
});

test("ingress rejects cross-origin, arbitrary bodies, excessive payloads and non-POST requests", async () => {
  const instrumentation = setup();
  const url = "http://localhost/api/telemetry";
  expect((await instrumentation.ingestBrowser(new Request(url))).status).toBe(405);
  expect(
    (
      await instrumentation.ingestBrowser(
        new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await instrumentation.ingestBrowser(
        new Request(url, {
          method: "POST",
          headers: { origin: "http://localhost", "content-type": "text/plain" },
          body: "x",
        }),
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await instrumentation.ingestBrowser(
        new Request(url, {
          method: "POST",
          headers: { origin: "http://localhost", "content-type": "application/json" },
          body: "x".repeat(32769),
        }),
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await instrumentation.ingestBrowser(
        new Request(url, {
          method: "POST",
          headers: { origin: "http://localhost", "content-type": "application/json" },
          body: JSON.stringify([{ ...browserEvent(), token: "private" }]),
        }),
      )
    ).status,
  ).toBe(400);
});

const probe = `
import { createInstrumentation } from "./src/server.ts";
const instrumentation = createInstrumentation({
  serviceName: "user",
  release: "abc123",
  routes: { "/": "home" },
});
const base = {
  route: "home",
  start: Date.now(),
  duration: 25,
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
  requestId: "11111111-1111-4111-8111-111111111111",
};
const response = await instrumentation.ingestBrowser(
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
await instrumentation
  .wrapRequest(new Request("http://localhost/"), () => {
    throw new RangeError("private@example.test");
  })
  .catch(() => undefined);
console.info(JSON.stringify({ event: "probe.done", status: response.status }));
`;

const lines = (output: string): unknown[] =>
  output
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));

test("browser events and server errors become structured log lines", async () => {
  const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", probe], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    timeout: 20_000,
  });
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
    expect.objectContaining({ event: "http.server.request", status: 500, release: "abc123" }),
  ]);
  expect(JSON.stringify(stderr)).toMatch(
    /"error\.fingerprint":"[0-9a-f]{8}".*"error\.fingerprint":"[0-9a-f]{8}"/,
  );
  expect(result.stderr).not.toContain("private@example.test");
});
