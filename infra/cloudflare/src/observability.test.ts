import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { workerObservability } from "./observability.ts";

it.effect(
  "app and budget Workers keep structured logs and every trace, continuing browser trace context",
  () =>
    Effect.sync(() => {
      assert.deepStrictEqual(workerObservability, {
        enabled: true,
        headSamplingRate: 1,
        logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
        traces: { enabled: true, headSamplingRate: 1, propagationPolicy: "accept" },
      });
    }),
);
