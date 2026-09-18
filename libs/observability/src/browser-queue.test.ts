import { setTimeout as wait } from "node:timers/promises";

import { describe, expect, test } from "vite-plus/test";

import { recordedDeliveries } from "./testing.ts";

const retryBackoffMilliseconds = 1000;
const secondBackoffMilliseconds = 2000;
const settleMilliseconds = 50;
const queueTimeout = 60_000;

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

describe("a batch whose delivery is refused", () => {
  const it = test.extend("deliveredBatches", async () =>
    recordedDeliveries({
      refuse: true,
      exercise: async ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        await flush();
        await flush();
      },
    }));

  it("is not resent within the backoff", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});

describe("a batch flushed again once the backoff has passed", () => {
  const it = test.extend("deliveredBatches", async () =>
    recordedDeliveries({
      refuse: true,
      exercise: async ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        await flush();
        await flush();
        await wait(retryBackoffMilliseconds);
        await flush();
      },
    }));

  it("is sent once more", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent]]);
  });
});

describe("a batch refused as many times as the queue allows", () => {
  const it = test.extend("deliveredBatches", async () =>
    recordedDeliveries({
      refuse: true,
      exercise: async ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        await flush();
        await wait(retryBackoffMilliseconds);
        await flush();
        await wait(secondBackoffMilliseconds);
        await flush();
        queue.flushBeforeUnload();
        await wait(settleMilliseconds);
      },
    }));

  it("stops at the limit", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent], [vitalEvent]]);
  });
});
