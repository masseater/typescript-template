import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { createInstrumentation } from "./server.ts";

const setup = () =>
  createInstrumentation({
    serviceName: "user",
    endpoint: "http://127.0.0.1:1",
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

test("external spans preserve non-HTTP results, real responses and original failures", async () => {
  const instrumentation = setup();
  const context = {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    requestId: crypto.randomUUID(),
    traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
  };
  const delivered = { messageId: crypto.randomUUID() };
  expect(
    await instrumentation.withExternalSpan(context, "email", () => Promise.resolve(delivered)),
  ).toBe(delivered);
  expect(
    await instrumentation.withExternalSpan(context, "email", () => Promise.resolve(undefined)),
  ).toBeUndefined();
  const response = new Response(null, { status: 503 });
  expect(
    await instrumentation.withExternalSpan(context, "email", () => Promise.resolve(response)),
  ).toBe(response);
  const failure = new Error("private provider failure");
  await expect(
    instrumentation.withExternalSpan(context, "email", () => Promise.reject(failure)),
  ).rejects.toBe(failure);
  expect(instrumentation.diagnostics()).toEqual({
    queuedBatches: 12,
    droppedRecords: 0,
    exportFailures: 0,
  });
});

test("collector failure cannot replace the real HTTP response and waitUntil settles without rejection", async () => {
  const instrumentation = setup();
  const background: Promise<unknown>[] = [];
  const response = await instrumentation.wrapRequest(
    new Request("http://localhost/?token=private"),
    () =>
      new Response("actual response", {
        status: 201,
        headers: { "set-cookie": "session=private; HttpOnly" },
      }),
    {
      waitUntil: (promise) => {
        background.push(promise);
      },
    },
  );
  await Promise.all(background);
  expect(response.status).toBe(201);
  expect(await response.text()).toBe("actual response");
  expect(response.headers.get("set-cookie")).toBe("session=private; HttpOnly");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  expect(instrumentation.diagnostics()).toMatchObject({
    queuedBatches: 0,
    exportFailures: 1,
    droppedRecords: 3,
  });
  await expect(instrumentation.flush()).resolves.toBeUndefined();
});

test("collector failure cannot replace a handler exception", async () => {
  const instrumentation = setup();
  const failure = new Error("sensitive application error");
  const background: Promise<unknown>[] = [];
  await expect(
    instrumentation.wrapRequest(
      new Request("http://localhost/"),
      () => {
        throw failure;
      },
      {
        waitUntil: (promise) => {
          background.push(promise);
        },
      },
    ),
  ).rejects.toBe(failure);
  await Promise.all(background);
  expect(instrumentation.diagnostics().exportFailures).toBe(1);
});

test("browser trace parent is propagated but caller-controlled request IDs are replaced", async () => {
  const instrumentation = setup();
  const background: Promise<unknown>[] = [];
  const response = await instrumentation.wrapRequest(
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
    {
      waitUntil: (promise) => {
        background.push(promise);
      },
    },
  );
  await Promise.all(background);
  expect(response.headers.get("traceparent")).toMatch(/^00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-/);
});

test("bounded queue drops countable records without breaking database action results", async () => {
  const instrumentation = setup();
  const context = {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    requestId: crypto.randomUUID(),
    traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
  };
  for (const index of Array.from({ length: 98 }, (_, value) => value)) {
    expect(await instrumentation.withDbSpan(context, "SELECT", () => Promise.resolve(index))).toBe(
      index,
    );
  }
  expect(instrumentation.diagnostics()).toEqual({
    queuedBatches: 192,
    droppedRecords: 4,
    exportFailures: 0,
  });
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
  expect(instrumentation.diagnostics().queuedBatches).toBe(0);
});

test("valid ingress is service-scoped and accepts events without exposing exporter secrets", async () => {
  const instrumentation = createInstrumentation({
    serviceName: "admin",
    endpoint: "http://127.0.0.1:1",
    release: "test",
    headers: { authorization: "Bearer private" },
    routes: { "/": "home" },
  });
  const background: Promise<unknown>[] = [];
  const response = await instrumentation.ingestBrowser(
    new Request("http://localhost/api/telemetry", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify([browserEvent()]),
    }),
    {
      waitUntil: (promise) => {
        background.push(promise);
      },
    },
  );
  await Promise.all(background);
  expect(response.status).toBe(202);
  expect(await response.text()).toBe("");
  expect(JSON.stringify([...response.headers])).not.toContain("private");
  expect(instrumentation.diagnostics()).toEqual({
    queuedBatches: 0,
    droppedRecords: 3,
    exportFailures: 1,
  });
});

const probe = `
import { createInstrumentation } from "./src/server.ts";
const instrumentation = createInstrumentation({
  serviceName: "user",
  endpoint: undefined,
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
console.log(JSON.stringify({ event: "probe.done", status: response.status, ...instrumentation.diagnostics() }));
`;

const lines = (output: string): unknown[] =>
  output
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));

test("without an OTLP endpoint, browser and server telemetry become structured Workers Logs lines", async () => {
  const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", probe], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    timeout: 20_000,
  });
  const stdout = lines(result.stdout);
  const stderr = lines(result.stderr);
  expect(stdout).toEqual([
    expect.objectContaining({
      event: "http.client.request",
      service: "user-browser",
      release: "abc123",
      trace_id: "a".repeat(32),
      "http.response.status_code": 201,
    }),
    expect.objectContaining({ event: "http.server.request", release: "abc123", status: 500 }),
    { event: "probe.done", status: 202, queuedBatches: 0, droppedRecords: 0, exportFailures: 0 },
  ]);
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
  ]);
  expect(JSON.stringify(stderr)).toMatch(
    /"error\.fingerprint":"[0-9a-f]{8}".*"error\.fingerprint":"[0-9a-f]{8}"/,
  );
  expect(result.stderr).not.toContain("private@example.test");
});
