import { Data, Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { makeEventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "./events.ts";

const retryBackoffMilliseconds = 1000;
const secondAttempt = 2;
const settleMilliseconds = 50;
const queueTimeout = 60_000;

class DeliveryRefused extends Data.TaggedError("DeliveryRefused") {}

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
  const it = test.extend("deliveredBatches", () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue((batch) =>
      Effect.runPromise(
        Effect.andThen(
          Ref.update(deliveredBatches, (earlier) => [...earlier, batch]),
          Effect.fail(new DeliveryRefused()),
        ),
      ),
    );
    eventQueue.enqueue(vitalEvent);
    return Effect.runPromise(
      Effect.gen(function* refusedDeliveries() {
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        return yield* Ref.get(deliveredBatches);
      }),
    );
  });

  it("is not resent within the backoff", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});

describe("a batch flushed again once the backoff has passed", () => {
  const it = test.extend("deliveredBatches", () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue((batch) =>
      Effect.runPromise(
        Effect.andThen(
          Ref.update(deliveredBatches, (earlier) => [...earlier, batch]),
          Effect.fail(new DeliveryRefused()),
        ),
      ),
    );
    eventQueue.enqueue(vitalEvent);
    return Effect.runPromise(
      Effect.gen(function* refusedDeliveries() {
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`);
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        return yield* Ref.get(deliveredBatches);
      }),
    );
  });

  it("is sent once more", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent]]);
  });
});

describe("a batch refused as many times as the queue allows", () => {
  const it = test.extend("deliveredBatches", () => {
    const deliveredBatches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
    const eventQueue = makeEventQueue((batch) =>
      Effect.runPromise(
        Effect.andThen(
          Ref.update(deliveredBatches, (earlier) => [...earlier, batch]),
          Effect.fail(new DeliveryRefused()),
        ),
      ),
    );
    eventQueue.enqueue(vitalEvent);
    return Effect.runPromise(
      Effect.gen(function* refusedDeliveries() {
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`);
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.sleep(
          `${retryBackoffMilliseconds * secondAttempt + settleMilliseconds} millis`,
        );
        yield* Effect.ignore(Effect.tryPromise(eventQueue.flush));
        yield* Effect.sync(eventQueue.flushBeforeUnload);
        yield* Effect.sleep(`${settleMilliseconds} millis`);
        return yield* Ref.get(deliveredBatches);
      }),
    );
  });

  it("stops at the limit", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent], [vitalEvent]]);
  });
});
