import { Effect } from "effect";

import { CHILD_PROCESS_EVENT } from "./node-event-names.ts";

const waitEmitterEvent = <Emission = void>(
  emitter: { once: (eventName: string, listener: (emission: Emission) => void) => unknown },
  eventName: string,
): Promise<Emission> =>
  Effect.runPromise(
    Effect.callback<Emission>((resume) => {
      emitter.once(eventName, (emission) => {
        resume(Effect.succeed(emission));
      });
    }),
  );

const waitChildExit = (child: {
  once: (
    event: string,
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ) => unknown;
}): Promise<readonly [number | null, NodeJS.Signals | null]> =>
  Effect.runPromise(
    Effect.callback<readonly [number | null, NodeJS.Signals | null]>((resume) => {
      child.once(CHILD_PROCESS_EVENT.exit, (code, signal) => {
        resume(Effect.succeed([code, signal]));
      });
    }),
  );

export { waitChildExit, waitEmitterEvent };
