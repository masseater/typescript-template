import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { exportedArrived } from "./receiver.ts";

const traceId = /^[0-9a-f]{32}$/u;

it.effect("the OTLP export path delivers a log and a trace to an in-process receiver", () =>
  Effect.gen(function* program() {
    const arrival = yield* exportedArrived();
    assert.strictEqual(arrival.log, "http.server.request");
    assert.strictEqual(arrival.span, "http.server.request");
    assert.match(arrival.traceId, traceId);
  }),
);
