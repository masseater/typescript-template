import { assert, it } from "@effect/vitest";
import { receiverOrigin } from "@repo/local";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import { exportedTelemetry } from "./exported.ts";

const traceId = "0123456789abcdeffedcba9876543210";
const spanId = "0123456789abcdef";
const requestId = "11111111-1111-4111-8111-111111111111";
const minutes = 15;
const millisecondsPerMinute = 60_000;
const nanosecondsPerMillisecond = 1_000_000;

function base64(hex: string): string {
  const bytes = hex.match(/../gu) ?? [];
  return btoa(String.fromCodePoint(...bytes.map((byte) => Number.parseInt(byte, 16))));
}

const tempoTrace = {
  batches: [
    {
      resource: { attributes: [{ key: "service.name", value: { stringValue: "user-server" } }] },
      scopeSpans: [
        {
          spans: [
            { name: "http.server.request", spanId: base64(spanId), traceId: base64(traceId) },
          ],
        },
      ],
    },
  ],
};

const lokiStreams = {
  data: {
    result: [
      {
        stream: {
          request_id: requestId,
          service_name: "user-server",
          span_id: spanId,
          trace_id: traceId,
        },
        values: [["1", "http.server.request"]],
      },
    ],
  },
};

it.effect("exported telemetry pairs the receiver's span and log for one trace", () =>
  Effect.gen(function* program() {
    const queried: string[] = [];
    const before = Date.now();
    const telemetry = yield* Effect.acquireUseRelease(
      Effect.sync(() => {
        const server = setupServer(
          http.get(`${receiverOrigin("traces")}/api/traces/:traceId`, () =>
            HttpResponse.json(tempoTrace),
          ),
          http.get(`${receiverOrigin("logs")}/loki/api/v1/query_range`, ({ request }) => {
            queried.push(request.url);
            return HttpResponse.json(lokiStreams);
          }),
        );
        server.listen({ onUnhandledRequest: "error" });
        return server;
      }),
      () => Effect.orDie(exportedTelemetry(traceId, minutes)),
      (server) =>
        Effect.sync(() => {
          server.close();
        }),
    );
    assert.deepStrictEqual(telemetry.spans, [
      { name: "http.server.request", service: "user-server", spanId, traceId },
    ]);
    assert.deepStrictEqual(telemetry.logs, [
      { message: "http.server.request", requestId, service: "user-server", spanId, traceId },
    ]);
    assert.lengthOf(queried, 1);
    const start =
      Number(new URL(String(queried[0])).searchParams.get("start")) / nanosecondsPerMillisecond;
    assert.isAtLeast(start, before - minutes * millisecondsPerMinute);
    assert.isAtMost(start, Date.now() - minutes * millisecondsPerMinute);
  }),
);
