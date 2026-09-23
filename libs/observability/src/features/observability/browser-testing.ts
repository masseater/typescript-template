import { Effect, Ref } from "effect";

import { makeEventQueue, type EventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "./events.ts";

export const recordedDeliveries = (delivery: {
  readonly refuse?: boolean;
  readonly exercise: (driver: {
    readonly queue: EventQueue;
    readonly flush: () => Promise<void>;
  }) => Promise<void>;
}): Promise<readonly (readonly BrowserEvent[])[]> => {
  const batches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
  const queue = makeEventQueue((batch) =>
    Effect.runPromise(
      Ref.update(batches, (earlier) => [...earlier, batch]).pipe(
        Effect.andThen(delivery.refuse === true ? Effect.die("delivery refused") : Effect.void),
      ),
    ),
  );
  return delivery
    .exercise({
      flush: () => Effect.runPromise(Effect.ignore(Effect.tryPromise(() => queue.flush()))),
      queue,
    })
    .then(() => Ref.getUnsafe(batches));
};
