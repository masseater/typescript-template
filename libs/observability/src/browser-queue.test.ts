import { Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { makeEventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "./events.ts";

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

describe("a batch whose delivery is refused", () => {
  const it = test.extend("deliveredBatches", async () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue(async (batch) => {
      Effect.runSync(Ref.update(deliveredBatches, (earlier) => [...earlier, batch]));
      return Promise.reject(new Error("delivery refused"));
    });
    eventQueue.enqueue(vitalEvent);
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    return Ref.getUnsafe(deliveredBatches);
  });

  it("is not resent within the backoff", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});

describe("a batch flushed again once the backoff has passed", () => {
  const it = test.extend("deliveredBatches", async () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue(async (batch) => {
      Effect.runSync(Ref.update(deliveredBatches, (earlier) => [...earlier, batch]));
      return Promise.reject(new Error("delivery refused"));
    });
    eventQueue.enqueue(vitalEvent);
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    await Effect.runPromise(
      Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`),
    );
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    return Ref.getUnsafe(deliveredBatches);
  });

  it("is sent once more", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent]]);
  });
});

describe("a batch refused as many times as the queue allows", () => {
  const it = test.extend("deliveredBatches", async () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue(async (batch) => {
      Effect.runSync(Ref.update(deliveredBatches, (earlier) => [...earlier, batch]));
      return Promise.reject(new Error("delivery refused"));
    });
    eventQueue.enqueue(vitalEvent);
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    await Effect.runPromise(
      Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`),
    );
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    await Effect.runPromise(
      Effect.sleep(`${retryBackoffMilliseconds * secondAttempt + settleMilliseconds} millis`),
    );
    await Effect.runPromise(Effect.ignore(Effect.tryPromise(eventQueue.flush)));
    eventQueue.flushBeforeUnload();
    await Effect.runPromise(Effect.sleep(`${settleMilliseconds} millis`));
    return Ref.getUnsafe(deliveredBatches);
  });

  it("stops at the limit", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent], [vitalEvent]]);
  });
});
