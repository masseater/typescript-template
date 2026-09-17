import { describe, expect, it } from "vite-plus/test";
import type { Instrumentation } from "./server.ts";
import { createInstrumentation } from "./server.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
import { httpStatus } from "./http-status.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";
const telemetryUrl = "http://localhost/api/telemetry";
const created = 201;
const noContent = 204;
const oversizedBody = 32_769;
const probeTimeoutMilliseconds = 20_000;
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

function logLines(output: string): unknown[] {
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line): unknown => JSON.parse(line));
}

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
    // oxlint-disable-next-line typescript/strict-void-return
    const result = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "-e", probe],
      { cwd: `${import.meta.dirname}/..`, timeout: probeTimeoutMilliseconds },
    );
    expect(logLines(result.stdout)).toStrictEqual([
      expect.objectContaining({
        event: "http.client.request",
        "http.response.status_code": created,
        release: "abc123",
        service: "user-browser",
        trace_id: traceId,
      }),
      { event: "probe.done", status: httpStatus.accepted },
    ]);
    const stderr = logLines(result.stderr);
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
    expect(result.stderr).not.toContain("private@example.test");
  });
});
