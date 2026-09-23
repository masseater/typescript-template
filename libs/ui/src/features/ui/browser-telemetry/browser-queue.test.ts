import { Array as Arr, Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { makeEventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "@repo/observability";

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
  const it = test.extend("deliveredBatches", () =>
    Effect.runPromise(
      Effect.gen(function* refusedTwice() {
        const deliveredBatches = yield* Ref.make<readonly (readonly BrowserEvent[])[]>([]);
        const runWithin = Effect.runPromiseWith(yield* Effect.context());
        const queue = makeEventQueue((batch) =>
          runWithin(
            Ref.update(deliveredBatches, Arr.append(batch)).pipe(
              Effect.andThen(Effect.die("delivery refused")),
            ),
          ),
        );
        const flush = Effect.ignore(Effect.tryPromise(queue.flush));
        queue.enqueue(vitalEvent);
        yield* flush;
        yield* flush;
        return yield* Ref.get(deliveredBatches);
      }),
    ));

  it("is not resent within the backoff", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent]]);
  });
});

describe("a batch flushed again once the backoff has passed", () => {
  const it = test.extend("deliveredBatches", () =>
    Effect.runPromise(
      Effect.gen(function* retriedAfterBackoff() {
        const deliveredBatches = yield* Ref.make<readonly (readonly BrowserEvent[])[]>([]);
        const runWithin = Effect.runPromiseWith(yield* Effect.context());
        const queue = makeEventQueue((batch) =>
          runWithin(
            Ref.update(deliveredBatches, Arr.append(batch)).pipe(
              Effect.andThen(Effect.die("delivery refused")),
            ),
          ),
        );
        const flush = Effect.ignore(Effect.tryPromise(queue.flush));
        queue.enqueue(vitalEvent);
        yield* flush;
        yield* flush;
        yield* Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`);
        yield* flush;
        return yield* Ref.get(deliveredBatches);
      }),
    ));

  it("is sent once more", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent]]);
  });
});

describe("a batch refused as many times as the queue allows", () => {
  const it = test.extend("deliveredBatches", () =>
    Effect.runPromise(
      Effect.gen(function* refusedUntilDropped() {
        const deliveredBatches = yield* Ref.make<readonly (readonly BrowserEvent[])[]>([]);
        const runWithin = Effect.runPromiseWith(yield* Effect.context());
        const queue = makeEventQueue((batch) =>
          runWithin(
            Ref.update(deliveredBatches, Arr.append(batch)).pipe(
              Effect.andThen(Effect.die("delivery refused")),
            ),
          ),
        );
        const flush = Effect.ignore(Effect.tryPromise(queue.flush));
        queue.enqueue(vitalEvent);
        yield* flush;
        yield* Effect.sleep(`${retryBackoffMilliseconds + settleMilliseconds} millis`);
        yield* flush;
        yield* Effect.sleep(
          `${retryBackoffMilliseconds * secondAttempt + settleMilliseconds} millis`,
        );
        yield* flush;
        queue.flushBeforeUnload();
        yield* Effect.sleep(`${settleMilliseconds} millis`);
        return yield* Ref.get(deliveredBatches);
      }),
    ));

  it("stops at the limit", { timeout: queueTimeout }, ({ deliveredBatches }) => {
    expect(deliveredBatches).toStrictEqual([[vitalEvent], [vitalEvent], [vitalEvent]]);
  });
});
