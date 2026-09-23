import { Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { makeEventQueue } from "./browser-queue.ts";
import { stoppableVitals } from "./vital-reporting.ts";

import type { BrowserEvent } from "./events.ts";

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
  const it = test.extend("deliveredBatches", async () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue(async (batch) => {
      Effect.runSync(Ref.update(deliveredBatches, (earlier) => [...earlier, batch]));
      return Promise.resolve();
    });
    const vitals = stoppableVitals((metric) => {
      eventQueue.enqueue({ ...vitalEvent, name: metric.name, value: metric.value });
    });
    vitals.report({ name: "INP", value: 1 });
    vitals.stop();
    vitals.report({ name: "LCP", value: 2 });
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    return Ref.getUnsafe(deliveredBatches);
  });

  it("carries the vital reported before the stop and nothing after it", ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});
