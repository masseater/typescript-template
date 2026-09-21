import { Effect, Ref } from "effect";

import type { JourneyFailure } from "./journey-failure.ts";

type Disposer = Effect.Effect<void, JourneyFailure>;

const disposeEach = (
  pending: readonly Effect.Effect<void, JourneyFailure>[],
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* disposeRemaining() {
    const [first, ...rest] = pending;
    if (first === undefined) {
      return;
    }
    yield* first.pipe(Effect.ignore);
    yield* disposeEach(rest);
  });

const newDisposerStack = (): {
  readonly collect: (disposer: Effect.Effect<void, JourneyFailure>) => void;
  readonly disposeAll: Effect.Effect<void, JourneyFailure>;
} => {
  const disposers = Ref.makeUnsafe<readonly Disposer[]>([]);
  return {
    collect: (dispose: Effect.Effect<void, JourneyFailure>) => {
      Effect.runSync(Ref.set(disposers, [...Ref.getUnsafe(disposers), dispose]));
    },
    disposeAll: Effect.suspend(() => disposeEach(Ref.getUnsafe(disposers))),
  };
};

export { newDisposerStack };
export type { Disposer, JourneyFailure };
