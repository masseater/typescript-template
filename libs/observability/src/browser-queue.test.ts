import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { recordedDeliveries } from "./browser-testing.ts";

const retryBackoffMilliseconds = 1000;
const secondAttempt = 2;
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

const wait = (milliseconds: number): Promise<void> =>
  Effect.runPromise(Effect.sleep(`${milliseconds} millis`));

describe("a batch whose delivery is refused", () => {
  const it = test.extend("deliveredBatches", () =>
    recordedDeliveries({
      refuse: true,
      exercise: ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        return flush().then(() => flush());
      },
    }));

  it("is not resent within the backoff", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});

describe("a batch flushed again once the backoff has passed", () => {
  const it = test.extend("deliveredBatches", () =>
    recordedDeliveries({
      refuse: true,
      exercise: ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        return flush()
          .then(() => flush())
          .then(() => wait(retryBackoffMilliseconds + settleMilliseconds))
          .then(() => flush());
      },
    }));

  it("is sent once more", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent]]);
  });
});

describe("a batch refused as many times as the queue allows", () => {
  const it = test.extend("deliveredBatches", () =>
    recordedDeliveries({
      refuse: true,
      exercise: ({ flush, queue }) => {
        queue.enqueue(vitalEvent);
        return flush()
          .then(() => wait(retryBackoffMilliseconds + settleMilliseconds))
          .then(() => flush())
          .then(() => wait(retryBackoffMilliseconds * secondAttempt + settleMilliseconds))
          .then(() => flush())
          .then(() => {
            queue.flushBeforeUnload();
            return wait(settleMilliseconds);
          });
      },
    }));

  it("stops at the limit", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent], [vitalEvent]]);
  });
});
