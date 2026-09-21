import { Effect, Ref } from "effect";

import { makeEventQueue, type EventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "./events.ts";

export const recordedDeliveries = async (delivery: {
  readonly refuse?: boolean;
  readonly exercise: (driver: {
    readonly queue: EventQueue;
    readonly flush: () => Promise<void>;
  }) => Promise<void>;
}): Promise<readonly (readonly BrowserEvent[])[]> => {
  const batches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
  const queue = makeEventQueue(async (batch) => {
    Effect.runSync(Ref.update(batches, (earlier) => [...earlier, batch]));
    return delivery.refuse === true
      ? Promise.reject(new Error("delivery refused"))
      : Promise.resolve();
  });
  await delivery.exercise({
    flush: async () =>
      Effect.runPromise(Effect.ignore(Effect.tryPromise(async () => queue.flush()))),
    queue,
  });
  return Ref.getUnsafe(batches);
};
