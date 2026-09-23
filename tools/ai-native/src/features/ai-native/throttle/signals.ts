import { Effect } from "effect";
import { attemptAsync } from "es-toolkit";

/** @canonical-values ai-native.interrupt-signal */
const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export const installInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.once(signal, takenHandler);
};

export const dropInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.removeListener(signal, takenHandler);
};

const raiseSignal = (signal: NodeJS.Signals): void => {
  process.kill(process.pid, signal);
};

export const makeWaitingInterruptHandler = (input: {
  entryPath: string;
  removeEntry: (entryPath: string) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    input.removeEntry(input.entryPath);
    raiseSignal(signal);
  };
};

const raiseAfterRelease = (
  dependencies: {
    release: () => Promise<void>;
    onUnreleased: (failure: Error) => void;
  },
  arrival: Promise<NodeJS.Signals | null>,
): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* raiseHeldSignal() {
      const signal = yield* Effect.promise(() => arrival);
      if (signal === null) {
        return;
      }
      const releaseHeldSlot = (): Promise<void> => dependencies.release();
      const [staleLease] = yield* Effect.promise(() => attemptAsync(releaseHeldSlot));
      if (staleLease !== null) {
        dependencies.onUnreleased(
          new Error(`releasing the slot before re-raising ${signal} failed`, { cause: staleLease }),
        );
      }
      raiseSignal(signal);
    }),
  );

export const makeHeldInterrupt = (dependencies: {
  release: () => Promise<void>;
  onUnreleased: (failure: Error) => void;
}): {
  readonly handler: (signal: NodeJS.Signals) => void;
  readonly standDown: () => void;
  readonly settled: Promise<void>;
} => {
  const arrival = Promise.withResolvers<NodeJS.Signals | null>();
  return {
    handler: arrival.resolve,
    standDown: (): void => {
      arrival.resolve(null);
    },
    settled: raiseAfterRelease(dependencies, arrival.promise),
  };
};

export const makeRunningInterruptHandler = (dependencies: {
  childPid: number;
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Error | null;
  reportFailure: (failure: Error) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    const failure = dependencies.signalTree({ pid: dependencies.childPid, signal });
    if (failure !== null) dependencies.reportFailure(failure);
  };
};
