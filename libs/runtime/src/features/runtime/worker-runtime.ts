import { Effect, Exit, ManagedRuntime } from "effect";

import type { Cause, Layer } from "effect";

const buildTimeout = "20 seconds";

type BuildFailure<Failure> = Failure | Cause.TimeoutError;

type WorkerRuntime<Services, Failure> = Readonly<{
  built: () => Promise<unknown>;
  dispose: () => Promise<void>;
  runPromise: <Value, Error>(effect: Effect.Effect<Value, Error, Services>) => Promise<Value>;
  runPromiseExit: <Value, Error>(
    effect: Effect.Effect<Value, Error, Services>,
  ) => Promise<Exit.Exit<Value, Error | BuildFailure<Failure>>>;
}>;

type Generation<Services, Failure> = Readonly<{
  build: Promise<Exit.Exit<unknown, BuildFailure<Failure>>>;
  runtime: ManagedRuntime.ManagedRuntime<Services, Failure>;
}>;

function workerRuntime<Services, Failure>(
  layer: () => Layer.Layer<Services, Failure>,
): WorkerRuntime<Services, Failure> {
  const state: { generation?: Generation<Services, Failure> } = {};
  function start(): Generation<Services, Failure> {
    const runtime = ManagedRuntime.make(layer());
    return {
      build: Effect.runPromiseExit(Effect.timeout(runtime.contextEffect, buildTimeout)),
      runtime,
    };
  }
  function ready(): Promise<
    Exit.Exit<ManagedRuntime.ManagedRuntime<Services, Failure>, BuildFailure<Failure>>
  > {
    state.generation ??= start();
    const { generation } = state;
    return generation.build.then((exit) => {
      if (Exit.isFailure(exit) && state.generation === generation) {
        delete state.generation;
      }
      return Exit.map(exit, () => generation.runtime);
    });
  }
  return {
    built: ready,
    dispose: () => state.generation?.runtime.dispose() ?? Promise.resolve(),
    runPromise: (effect) =>
      ready().then((runtime) =>
        Exit.isSuccess(runtime)
          ? runtime.value.runPromise(effect)
          : Effect.runPromise(Exit.failCause(runtime.cause)),
      ),
    runPromiseExit: <Value, Error>(
      effect: Effect.Effect<Value, Error, Services>,
    ): Promise<Exit.Exit<Value, Error | BuildFailure<Failure>>> =>
      ready().then((runtime): Promise<Exit.Exit<Value, Error | BuildFailure<Failure>>> => {
        if (Exit.isSuccess(runtime)) {
          return runtime.value.runPromiseExit(effect);
        }
        return Promise.resolve(Exit.failCause(runtime.cause));
      }),
  };
}

export { workerRuntime };
export type { WorkerRuntime };
