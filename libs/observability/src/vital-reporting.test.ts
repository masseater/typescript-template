import { describe, expect, test } from "vite-plus/test";

import { recordedDeliveries } from "./testing.ts";
import { stoppableVitals } from "./vital-reporting.ts";

const vitalEvent = {
  duration: 0,
  kind: "vital",
  method: "GET",
  name: "INP",
  requestId: "11111111-1111-4111-8111-111111111111",
  route: "home",
  spanId: "bbbbbbbbbbbbbbbb",
  start: 1_800_000_000_000,
  status: 0,
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  value: 1,
} as const;

describe("vitals reported around the stop", () => {
  const it = test.extend("deliveredBatches", async () =>
    recordedDeliveries({
      exercise: async ({ flush, queue }) => {
        const vitals = stoppableVitals((metric) => {
          queue.enqueue({ ...vitalEvent, name: metric.name, value: metric.value });
        });
        vitals.report({ name: "INP", value: 1 });
        vitals.stop();
        vitals.report({ name: "LCP", value: 2 });
        await flush();
      },
    }));

  it("carries the vital reported before the stop and nothing after it", ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});
