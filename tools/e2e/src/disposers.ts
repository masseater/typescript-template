import { Effect, Ref } from "effect";

type Disposer = () => Promise<void>;

const disposeEach = async (disposers: readonly Disposer[]): Promise<void> => {
  const [first, ...rest] = disposers;
  if (first === undefined) {
    return;
  }
  await Promise.allSettled([first()]);
  await disposeEach(rest);
};

const newDisposerStack = (): {
  readonly collect: (disposer: Disposer) => void;
  readonly disposeAll: () => Promise<void>;
} => {
  const disposers = Ref.makeUnsafe<readonly Disposer[]>([]);
  return {
    collect: (disposer) => {
      Effect.runSync(Ref.set(disposers, [...Ref.getUnsafe(disposers), disposer]));
    },
    disposeAll: async () => disposeEach(Ref.getUnsafe(disposers)),
  };
};

export { newDisposerStack };
export type { Disposer };
