import { Effect, Exit, ManagedRuntime, type Cause, type Layer } from "effect";
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
const workerRuntime = <Services, Failure>(
  layer: () => Layer.Layer<Services, Failure>,
): WorkerRuntime<Services, Failure> => {
  const generationSlot: {
    generation?: Generation<Services, Failure>;
  } = {};
  const start = (): Generation<Services, Failure> => {
    const runtime = ManagedRuntime.make(layer());
    return {
      build: Effect.runPromiseExit(Effect.timeout(runtime.contextEffect, buildTimeout)),
      runtime,
    };
  };
  const ready = async (): Promise<
    Exit.Exit<ManagedRuntime.ManagedRuntime<Services, Failure>, BuildFailure<Failure>>
  > => {
    generationSlot.generation ??= start();
    const { generation } = generationSlot;
    const exit = await generation.build;
    if (Exit.isFailure(exit) && generationSlot.generation === generation) {
      delete generationSlot.generation;
    }
    return Exit.map(exit, () => generation.runtime);
  };
  return {
    built: ready,
    dispose: async () => generationSlot.generation?.runtime.dispose(),
    runPromise: async (effect) => {
      const runtime = await ready();
      return Exit.isSuccess(runtime)
        ? runtime.value.runPromise(effect)
        : Effect.runPromise(Exit.failCause(runtime.cause));
    },
    runPromiseExit: async (effect) => {
      const runtime = await ready();
      return Exit.isSuccess(runtime)
        ? runtime.value.runPromiseExit(effect)
        : Exit.failCause(runtime.cause);
    },
  };
};
export { workerRuntime };
export type { WorkerRuntime };
