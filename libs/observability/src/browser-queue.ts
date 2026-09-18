import { Array as Arr, Effect, Queue, Semaphore, type Cause } from "effect";

import { maximumBatchSize, type BrowserEvent } from "./events.ts";
import { logError } from "./log.ts";

const maximumPendingEvents = 128;

export type EventQueue = {
  readonly enqueue: (browserEvent: BrowserEvent) => void;
  readonly flushInBackground: () => void;
  readonly flushBeforeUnload: () => void;
  readonly close: () => void;
};

const reportExportFailure = Effect.sync(() => {
  logError({ event: "browser.telemetry_export_failed" });
});

export const makeEventQueue = (
  deliver: (batch: readonly BrowserEvent[]) => Promise<void>,
): EventQueue => {
  const pending = Effect.runSync(Queue.dropping<BrowserEvent, Cause.Done>(maximumPendingEvents));
  const drainPermit = Semaphore.makeUnsafe(1);
  const settled = (delivery: Effect.Effect<void, unknown>): Effect.Effect<void> =>
    delivery.pipe(
      Effect.tapError(() => reportExportFailure),
      Effect.ignore,
    );
  const requeue = (batch: readonly BrowserEvent[]): Effect.Effect<void> =>
    Effect.sync(() => {
      Queue.offerAllUnsafe(pending, batch);
    });
  const delivered = (batch: readonly BrowserEvent[]): Effect.Effect<void, unknown> =>
    Effect.tryPromise({ catch: (failure) => failure, try: async () => deliver(batch) });
  const drain = (): Effect.Effect<void, unknown> =>
    Queue.sizeUnsafe(pending) === 0
      ? Effect.void
      : Queue.takeBetween(pending, 1, maximumBatchSize).pipe(
          Effect.flatMap((batch) => delivered(batch).pipe(Effect.tapError(() => requeue(batch)))),
          Effect.flatMap(drain),
        );
  return {
    close: () => {
      Queue.endUnsafe(pending);
    },
    enqueue: (browserEvent) => {
      if (!Queue.offerUnsafe(pending, browserEvent) && Queue.isFullUnsafe(pending)) {
        logError({ event: "browser.telemetry_queue_full" });
      }
    },
    flushBeforeUnload: () => {
      const unsent = Effect.runSync(Queue.clear(pending).pipe(Effect.orElseSucceed(() => [])));
      for (const batch of Arr.chunksOf(unsent, maximumBatchSize)) {
        Effect.runFork(settled(delivered(batch)));
      }
    },
    flushInBackground: () => {
      Effect.runFork(settled(Semaphore.withPermit(drainPermit)(Effect.suspend(drain))));
    },
  };
};
