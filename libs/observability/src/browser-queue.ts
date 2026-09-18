import { Array as Arr, Console, Effect, Queue, Ref, Schema, Semaphore, type Cause } from "effect";

import { maximumBatchSize, type BrowserEvent } from "./events.ts";

class DeliveryRefused extends Schema.TaggedError<DeliveryRefused>()("DeliveryRefused", {
  cause: Schema.Defect(),
}) {}

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

const settled = (
  delivery: Effect.Effect<void, DeliveryRefused | Cause.Done>,
): Effect.Effect<void> =>
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
  const retrying = Ref.makeUnsafe<readonly BrowserEvent[]>([]);
  const giveUpOrRetry = (batch: readonly BrowserEvent[]): Effect.Effect<void> =>
    Effect.gen(function* giveUpOrRetryProgram() {
      const refused = yield* Ref.modify(refusals, (counted) => [counted + 1, counted + 1]);
      yield* Ref.set(retryAt, Date.now() + backoffAfter(refused));
      if (refused < maximumDeliveryAttempts) {
        return yield* Ref.set(retrying, batch);
      }
      yield* Ref.set(refusals, 0);
      return yield* reportBatchDropped;
    });
  const delivered = (batch: readonly BrowserEvent[]): Effect.Effect<void, DeliveryRefused> =>
    Effect.tryPromise({
      catch: (cause) => new DeliveryRefused({ cause }),
      try: async () => deliver(batch),
    }).pipe(
      Effect.tapError(() => giveUpOrRetry(batch)),
      Effect.tap(() => Effect.andThen(Ref.set(refusals, 0), Ref.set(retryAt, 0))),
    );
  const drain = (): Effect.Effect<void, DeliveryRefused | Cause.Done> =>
    Effect.gen(function* drainProgram() {
      const held = yield* Ref.getAndSet(retrying, []);
      if (
        Date.now() < (yield* Ref.get(retryAt)) ||
        (held.length === 0 && Queue.sizeUnsafe(pending) === 0)
      ) {
        yield* Ref.set(retrying, held);
        return;
      }
      yield* delivered(
        held.length > 0 ? held : yield* Queue.takeBetween(pending, 1, maximumBatchSize),
      );
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
      const unsent = [
        ...Effect.runSync(Ref.getAndSet(retrying, [])),
        ...Effect.runSync(Queue.clear(pending).pipe(Effect.orElseSucceed(() => []))),
      ];
      for (const batch of Arr.chunksOf(unsent, maximumBatchSize)) {
        const delivery = deliver(batch);
        Effect.runFork(
          settled(
            Effect.tryPromise({
              catch: (cause) => new DeliveryRefused({ cause }),
              try: async () => delivery,
            }),
          ),
        );
      }
    },
    flushInBackground: () => {
      Effect.runFork(settled(drainOnce));
    },
  };
};
