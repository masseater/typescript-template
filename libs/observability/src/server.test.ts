import { describe, expect, it } from "vite-plus/test";
import type { Instrumentation } from "./server.ts";
import { createInstrumentation } from "./server.ts";
import { httpStatus } from "./http-status.ts";

const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";
const telemetryUrl = "http://localhost/api/telemetry";
const created = 201;
const noContent = 204;
const queuedDbCalls = 98;
const oversizedBody = 32_769;
const jsonHeaders = { "content-type": "application/json", origin: "http://localhost" };

function setup(): Instrumentation {
  return createInstrumentation({
    endpoint: "http://127.0.0.1:1",
    routes: { "/": "home", "/api/telemetry": "telemetry" },
    serviceName: "user",
  });
}

function requestContext(): {
  requestId: string;
  spanId: string;
  traceId: string;
  traceparent: string;
} {
  return {
    requestId: crypto.randomUUID(),
    spanId,
    traceId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
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

interface TrackedRun {
  readonly background: Promise<unknown>[];
  readonly executionContext: { readonly waitUntil: (promise: Promise<unknown>) => void };
  readonly instrumentation: Instrumentation;
}

function trackedRun(instrumentation: Instrumentation = setup()): TrackedRun {
  const background: Promise<unknown>[] = [];
  return {
    background,
    executionContext: {
      waitUntil: (promise) => {
        background.push(promise);
      },
    },
    instrumentation,
  };
}

async function ingestStatus(instrumentation: Instrumentation, init?: RequestInit): Promise<number> {
  const response = await instrumentation.ingestBrowser(new Request(telemetryUrl, init));
  return response.status;
}

const unavailable = new Response(undefined, { status: httpStatus.serviceUnavailable });
const providerFailure = new Error("private provider failure");

describe("external spans", () => {
  it("preserve non-HTTP results, real responses and original failures", async () => {
    expect.hasAssertions();
    const instrumentation = setup();
    const context = requestContext();
    const delivered = { messageId: crypto.randomUUID() };
    await expect(
      instrumentation.withExternalSpan(context, "email", async () => delivered),
    ).resolves.toBe(delivered);
    await expect(
      instrumentation.withExternalSpan(context, "email", async () => {
        await Promise.resolve();
      }),
    ).resolves.toBeUndefined();
    await expect(
      instrumentation.withExternalSpan(context, "email", async () => unavailable),
    ).resolves.toBe(unavailable);
    await expect(
      instrumentation.withExternalSpan(context, "email", async () => {
        throw providerFailure;
      }),
    ).rejects.toBe(providerFailure);
    expect(instrumentation.diagnostics()).toStrictEqual({
      droppedRecords: 0,
      exportFailures: 0,
      queuedBatches: 12,
    });
  });
});

describe("request wrapping", () => {
  it("collector failure cannot replace the real HTTP response and waitUntil settles without rejection", async () => {
    expect.hasAssertions();
    const { background, executionContext, instrumentation } = trackedRun();
    const response = await instrumentation.wrapRequest(
      new Request("http://localhost/?token=private"),
      () =>
        new Response("actual response", {
          headers: { "set-cookie": "session=private; HttpOnly" },
          status: created,
        }),
      executionContext,
    );
    await Promise.all(background);
    const text = await response.text();
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(response.headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
    expect({
      cookie: response.headers.get("set-cookie"),
      diagnostics: instrumentation.diagnostics(),
      status: response.status,
      text,
    }).toStrictEqual({
      cookie: "session=private; HttpOnly",
      diagnostics: { droppedRecords: 3, exportFailures: 1, queuedBatches: 0 },
      status: created,
      text: "actual response",
    });
    await expect(instrumentation.flush()).resolves.toBeUndefined();
  });

  it("collector failure cannot replace a handler exception", async () => {
    expect.hasAssertions();
    const { background, executionContext, instrumentation } = trackedRun();
    const failure = new Error("sensitive application error");
    function handler(): Response {
      throw failure;
    }
    await expect(
      instrumentation.wrapRequest(new Request("http://localhost/"), handler, executionContext),
    ).rejects.toBe(failure);
    await Promise.all(background);
    expect(instrumentation.diagnostics().exportFailures).toBe(1);
  });
});

describe("trace propagation", () => {
  it("browser trace parent is propagated but caller-controlled request IDs are replaced", async () => {
    expect.hasAssertions();
    const { background, executionContext, instrumentation } = trackedRun();
    const incoming = new Request("http://localhost/", {
      headers: { traceparent: `00-${traceId}-${spanId}-01`, "x-request-id": "private@example.com" },
    });
    const observed: { traceId?: string; requestId?: string } = {};
    const response = await instrumentation.wrapRequest(
      incoming,
      (_request, context) => {
        Object.assign(observed, { requestId: context.requestId, traceId: context.traceId });
        return new Response(undefined, { status: noContent });
      },
      executionContext,
    );
    await Promise.all(background);
    expect(observed.traceId).toBe(traceId);
    expect(observed.requestId).not.toBe("private@example.com");
    expect(response.headers.get("traceparent")).toMatch(new RegExp(`^00-${traceId}-`, "u"));
  });
});

describe("export queue", () => {
  it("bounded queue drops countable records without breaking database action results", async () => {
    expect.hasAssertions();
    const instrumentation = setup();
    const context = requestContext();
    const indexes = Array.from({ length: queuedDbCalls }, (_unused, index) => index);
    const results = await Promise.all(
      indexes.map(async (index) =>
        instrumentation.withDbSpan(context, "SELECT", async () => index),
      ),
    );
    expect(results).toStrictEqual(indexes);
    expect(instrumentation.diagnostics()).toStrictEqual({
      droppedRecords: 4,
      exportFailures: 0,
      queuedBatches: 192,
    });
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
});

describe("browser ingress bodies", () => {
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
    expect(instrumentation.diagnostics().queuedBatches).toBe(0);
  });

  it("valid ingress is service-scoped and accepts events without exposing exporter secrets", async () => {
    expect.hasAssertions();
    const { background, executionContext, instrumentation } = trackedRun(
      createInstrumentation({
        endpoint: "http://127.0.0.1:1",
        headers: { authorization: "Bearer private" },
        routes: { "/": "home" },
        serviceName: "admin",
      }),
    );
    const body = JSON.stringify([browserEvent()]);
    const request = new Request(telemetryUrl, { body, headers: jsonHeaders, method: "POST" });
    const response = await instrumentation.ingestBrowser(request, executionContext);
    await Promise.all(background);
    expect(response.status).toBe(httpStatus.accepted);
    await expect(response.text()).resolves.toBe("");
    expect(JSON.stringify([...response.headers])).not.toContain("private");
    expect(instrumentation.diagnostics()).toStrictEqual({
      droppedRecords: 3,
      exportFailures: 1,
      queuedBatches: 0,
    });
  });
});
