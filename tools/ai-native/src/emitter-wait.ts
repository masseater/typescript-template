import { Effect } from "effect";

const waitEmitterEvent = (
  emitter: { once: (eventName: string, listener: () => void) => unknown },
  eventName: string,
): Promise<void> =>
  Effect.runPromise(
    Effect.callback((resume) => {
      emitter.once(eventName, () => {
        resume(Effect.void);
      });
    }),
  );

export { waitEmitterEvent };
