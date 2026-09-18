import { HttpResponse, http } from "msw";
import { Telemetry, flushTelemetry, observeRequest } from "./server.ts";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { OtlpDestination } from "./otlp.ts";
import { setupNetwork } from "@msw/cloudflare";

interface Observed {
  readonly authorization: readonly string[];
  readonly lines: readonly unknown[];
  readonly logs: readonly unknown[];
  readonly traceparent: string;
  readonly traces: readonly unknown[];
}

const endpoint = "https://otlp.example.test";
const authorization = "Bearer otlp-test-token";
const noContent = 204;
const exportedTraceIds = /"traceId":"(?<traceId>[0-9a-f]{32})"/gu;
const traceparentTraceId = /^00-(?<traceId>[0-9a-f]{32})-[0-9a-f]{16}-01$/u;
const traceIdPattern = /^[0-9a-f]{32}$/u;

function receiving(
  collect: (signal: "logs" | "traces") => Parameters<typeof http.post>[1],
): Effect.Effect<ReturnType<typeof setupNetwork>> {
  return Effect.sync(() => {
    const network = setupNetwork();
    network.configure({ onUnhandledFrame: "error" });
    network.use(
      http.post(`${endpoint}/v1/traces`, collect("traces")),
      http.post(`${endpoint}/v1/logs`, collect("logs")),
    );
    network.enable();
    return network;
  });
}

function observed(otlp?: OtlpDestination): Effect.Effect<Observed> {
  const seen = { authorization: [] as string[], logs: [] as unknown[], traces: [] as unknown[] };
  const lines: unknown[] = [];
  function collect(signal: "logs" | "traces"): Parameters<typeof http.post>[1] {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    return async ({ request }) => {
      seen.authorization.push(request.headers.get("authorization") ?? "");
      seen[signal].push(await request.json());
      return HttpResponse.json({});
    };
  }
  function record(line: string): void {
    lines.push(JSON.parse(line));
  }
  const telemetry = Telemetry.layer({
    log: { error: record, info: record },
    otlp,
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "user",
  });
  return Effect.acquireUseRelease(
    receiving(collect),
    () =>
      Effect.gen(function* observedProgram() {
        const response = yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: noContent })),
        );
        yield* flushTelemetry;
        return { ...seen, lines, traceparent: response.headers.get("traceparent") ?? "" };
      }).pipe(Effect.provide(telemetry), Effect.orDie),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

function traceIds(payload: readonly unknown[]): readonly string[] {
  const matches = JSON.stringify(payload).matchAll(exportedTraceIds);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return Array.from(matches, (match) => match.groups?.["traceId"] ?? "");
}

function requestTraceId(traceparent: string): string {
  return traceparentTraceId.exec(traceparent)?.groups?.["traceId"] ?? "";
}

it.effect("spans, logs and the response share one trace id at the OTLP endpoint", () =>
  Effect.gen(function* program() {
    const telemetry = yield* observed({ authorization, endpoint });
    const traceId = requestTraceId(telemetry.traceparent);
    assert.match(traceId, traceIdPattern);
    assert.deepStrictEqual(traceIds(telemetry.traces), [traceId]);
    assert.deepStrictEqual(traceIds(telemetry.logs), [traceId]);
    assert.containSubset(telemetry.lines, [
      { event: "http.server.request", service: "user-server", trace_id: traceId },
    ]);
    assert.deepStrictEqual(new Set(telemetry.authorization), new Set([authorization]));
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
