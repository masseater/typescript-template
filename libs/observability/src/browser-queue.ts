import { Array as Arr, Console, Effect, Queue, Ref, Semaphore, type Cause } from "effect";

import { maximumBatchSize, type BrowserEvent } from "./events.ts";

const maximumPendingEvents = 128;
const maximumDeliveryAttempts = 3;
const retryBackoffMilliseconds = 1000;
const maximumRetryBackoffMilliseconds = 60_000;
const backoffFactor = 2;

const backoffAfter = (refusals: number): number =>
  Math.min(
    retryBackoffMilliseconds * backoffFactor ** (refusals - 1),
    maximumRetryBackoffMilliseconds,
  );

export type EventQueue = {
  readonly enqueue: (browserEvent: BrowserEvent) => void;
  readonly flush: () => Promise<void>;
  readonly flushInBackground: () => void;
  readonly flushBeforeUnload: () => void;
  readonly close: () => void;
};

const reportExportFailure = Console.error(
  JSON.stringify({ event: "browser.telemetry_export_failed" }),
);

const reportBatchDropped = Console.error(
  JSON.stringify({ event: "browser.telemetry_batch_dropped" }),
);

const settled = (delivery: Effect.Effect<void, unknown>): Effect.Effect<void> =>
  delivery.pipe(
    Effect.tapError(() => reportExportFailure),
    Effect.ignore,
  );

export const makeEventQueue = (
  deliver: (batch: readonly BrowserEvent[]) => Promise<void>,
): EventQueue => {
  const pending = Effect.runSync(Queue.dropping<BrowserEvent, Cause.Done>(maximumPendingEvents));
  const refusals = Ref.makeUnsafe(0);
  const retryAt = Ref.makeUnsafe(0);
  const giveUpOrRetry = (batch: readonly BrowserEvent[]): Effect.Effect<void> =>
    Effect.gen(function* giveUpOrRetryProgram() {
      const refused = yield* Ref.modify(refusals, (counted) => [counted + 1, counted + 1]);
      yield* Ref.set(retryAt, Date.now() + backoffAfter(refused));
      if (refused < maximumDeliveryAttempts) {
        return yield* Effect.sync(() => {
          Queue.offerAllUnsafe(pending, batch);
        });
      }
      yield* Ref.set(refusals, 0);
      return yield* reportBatchDropped;
    });
  const delivered = (batch: readonly BrowserEvent[]): Effect.Effect<void, unknown> =>
    Effect.tryPromise({ catch: (failure) => failure, try: async () => deliver(batch) }).pipe(
      Effect.tapError(() => giveUpOrRetry(batch)),
      Effect.tap(() => Effect.andThen(Ref.set(refusals, 0), Ref.set(retryAt, 0))),
    );
  const drain = (): Effect.Effect<void, unknown> =>
    Effect.gen(function* drainProgram() {
      if (Date.now() < (yield* Ref.get(retryAt)) || Queue.sizeUnsafe(pending) === 0) {
        return;
      }
      yield* delivered(yield* Queue.takeBetween(pending, 1, maximumBatchSize));
      yield* drain();
    });
  const drainOnce = Semaphore.withPermit(Semaphore.makeUnsafe(1))(Effect.suspend(drain));
  return {
    close: () => {
      Queue.endUnsafe(pending);
    },
    enqueue: (browserEvent) => {
      if (!Queue.offerUnsafe(pending, browserEvent) && Queue.isFullUnsafe(pending)) {
        Effect.runSync(Console.error(JSON.stringify({ event: "browser.telemetry_queue_full" })));
      }
    },
    flush: async () => Effect.runPromise(drainOnce),
    flushBeforeUnload: () => {
      const unsent = Effect.runSync(Queue.clear(pending).pipe(Effect.orElseSucceed(() => [])));
      for (const batch of Arr.chunksOf(unsent, maximumBatchSize)) {
        Effect.runFork(settled(Effect.tryPromise(async () => deliver(batch))));
      }
    },
    flushInBackground: () => {
      Effect.runFork(settled(drainOnce));
    },
  };
};
