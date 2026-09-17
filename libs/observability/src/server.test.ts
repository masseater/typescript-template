import { describe, expect, it } from "vite-plus/test";
import type { Instrumentation } from "./server.ts";
import { createInstrumentation } from "./server.ts";
import { httpStatus } from "./http-status.ts";

const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";
const telemetryUrl = "http://localhost/api/telemetry";
const created = 201;
const noContent = 204;
const oversizedBody = 32_769;
const jsonHeaders = { "content-type": "application/json", origin: "http://localhost" };

function setup(): Instrumentation {
  return createInstrumentation({
    release: "test",
    routes: { "/": "home", "/api/telemetry": "telemetry" },
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
    spanId,
    start: Date.now(),
    status: created,
    traceId,
    value: 0,
  };
}

async function ingestStatus(
  instrumentation: Instrumentation,
  init?: Readonly<{
    body?: string;
    headers?: Readonly<Record<string, string>>;
    method?: string;
  }>,
): Promise<number> {
  const response = await instrumentation.ingestBrowser(new Request(telemetryUrl, init));
  return response.status;
}

interface RecordedLogs {
  readonly stderr: unknown[];
  readonly stdout: unknown[];
}

function recordedInstrumentation(): Readonly<{
  instrumentation: Instrumentation;
  logs: RecordedLogs;
}> {
  const logs: RecordedLogs = { stderr: [], stdout: [] };
  const instrumentation = createInstrumentation({
    log: {
      error: (line) => {
        logs.stderr.push(JSON.parse(line));
      },
      info: (line) => {
        logs.stdout.push(JSON.parse(line));
      },
    },
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "user",
  });
  return { instrumentation, logs };
}

function probeEvents(): string {
  const base = {
    duration: 25,
    requestId: "11111111-1111-4111-8111-111111111111",
    route: "home",
    spanId,
    start: Date.now(),
    traceId,
  };
  return JSON.stringify([
    {
      ...base,
      kind: "http",
      method: "POST",
      name: "http.client.request",
      status: created,
      value: 0,
    },
    {
      ...base,
      errorType: "TypeError",
      kind: "exception",
      locations: "/assets/index-abc.js:1:234",
      method: "GET",
      name: "browser.error",
      status: 0,
      value: 1,
    },
  ]);
}

function throwPrivateError(): never {
  throw new RangeError("private@example.test");
}

async function runProbe(instrumentation: Instrumentation): Promise<number> {
  const response = await instrumentation.ingestBrowser(
    new Request(telemetryUrl, { body: probeEvents(), headers: jsonHeaders, method: "POST" }),
  );
  await instrumentation
    .wrapRequest(new Request("http://localhost/"), throwPrivateError)
    .catch((error: unknown) => error);
  return response.status;
}

describe("request wrapping", () => {
  it("the real HTTP response keeps its body and headers and gains correlation headers", async () => {
    expect.hasAssertions();
    const response = await setup().wrapRequest(
      new Request("http://localhost/?token=private"),
      () =>
        new Response("actual response", {
          headers: { "set-cookie": "session=private; HttpOnly" },
          status: created,
        }),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(response.headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
    expect({
      cookie: response.headers.get("set-cookie"),
      status: response.status,
      text: await response.text(),
    }).toStrictEqual({
      cookie: "session=private; HttpOnly",
      status: created,
      text: "actual response",
    });
  });

  it("handler exceptions are rethrown unchanged", async () => {
    expect.hasAssertions();
    const failure = new Error("sensitive application error");
    function handler(): Response {
      throw failure;
    }
    await expect(setup().wrapRequest(new Request("http://localhost/"), handler)).rejects.toBe(
      failure,
    );
  });
});

describe("trace propagation", () => {
  it("browser trace parent is propagated but caller-controlled request IDs are replaced", async () => {
    expect.hasAssertions();
    const incoming = new Request("http://localhost/", {
      headers: { traceparent: `00-${traceId}-${spanId}-01`, "x-request-id": "private@example.com" },
    });
    const observed: { traceId?: string; requestId?: string } = {};
    const response = await setup().wrapRequest(
      incoming,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (_request, context) => {
        Object.assign(observed, { requestId: context.requestId, traceId: context.traceId });
        return new Response(undefined, { status: noContent });
      },
    );
    expect(observed.traceId).toBe(traceId);
    expect(observed.requestId).not.toBe("private@example.com");
    expect(response.headers.get("traceparent")).toMatch(new RegExp(`^00-${traceId}-`, "u"));
  });
});

describe("browser ingress", () => {
  it("rejects non-POST and cross-origin requests", async () => {
    expect.hasAssertions();
    const instrumentation = setup();
    await expect(ingestStatus(instrumentation)).resolves.toBe(httpStatus.methodNotAllowed);
    await expect(
      ingestStatus(instrumentation, {
        headers: { origin: "https://evil.example" },
        method: "POST",
      }),
    ).resolves.toBe(httpStatus.forbidden);
  });

  it("rejects arbitrary bodies and excessive payloads", async () => {
    expect.hasAssertions();
    const instrumentation = setup();
    const plain = {
      body: "x",
      headers: { ...jsonHeaders, "content-type": "text/plain" },
      method: "POST",
    };
    await expect(ingestStatus(instrumentation, plain)).resolves.toBe(
      httpStatus.unsupportedMediaType,
    );
    const oversized = { body: "x".repeat(oversizedBody), headers: jsonHeaders, method: "POST" };
    await expect(ingestStatus(instrumentation, oversized)).resolves.toBe(
      httpStatus.payloadTooLarge,
    );
    const body = JSON.stringify([{ ...browserEvent(), token: "private" }]);
    await expect(
      ingestStatus(instrumentation, { body, headers: jsonHeaders, method: "POST" }),
    ).resolves.toBe(httpStatus.badRequest);
  });
});

describe("structured log lines", () => {
  it("browser events and server errors become structured log lines", async () => {
    expect.hasAssertions();
    const { instrumentation, logs } = recordedInstrumentation();
    await expect(runProbe(instrumentation)).resolves.toBe(httpStatus.accepted);
    expect(logs.stdout).toStrictEqual([
      expect.objectContaining({
        event: "http.client.request",
        "http.response.status_code": created,
        release: "abc123",
        service: "user-browser",
        trace_id: traceId,
      }),
    ]);
    const { stderr } = logs;
    expect(stderr).toStrictEqual([
      expect.objectContaining({
        "error.locations": "/assets/index-abc.js:1:234",
        "error.type": "TypeError",
        event: "browser.error",
        request_id: "11111111-1111-4111-8111-111111111111",
        service: "user-browser",
      }),
      expect.objectContaining({
        "error.type": "RangeError",
        event: "application.error",
        release: "abc123",
        service: "user-server",
      }),
      expect.objectContaining({
        event: "http.server.request",
        release: "abc123",
        status: httpStatus.internalServerError,
      }),
    ]);
    expect(JSON.stringify(stderr)).toMatch(
      /"error\.fingerprint":"[0-9a-f]{8}".*"error\.fingerprint":"[0-9a-f]{8}"/u,
    );
    expect(JSON.stringify(stderr)).not.toContain("private@example.test");
  });
});
