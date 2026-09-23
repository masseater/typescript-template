import { Effect } from "effect";

const waitEmitterEvent = <Emission = void>(
  emitter: { once: (eventName: string, listener: (emission: Emission) => void) => unknown },
  eventName: string,
): Promise<Emission> =>
  Effect.runPromise(
    Effect.callback<Emission>((resume) => {
      emitter.once(eventName, (...emissions: readonly unknown[]) => {
        resume(Effect.succeed((emissions.length <= 1 ? emissions[0] : emissions) as Emission));
      });
    }),
  );

export { waitEmitterEvent };
