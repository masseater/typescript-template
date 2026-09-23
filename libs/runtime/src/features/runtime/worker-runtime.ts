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
  const ready = (): Promise<
    Exit.Exit<ManagedRuntime.ManagedRuntime<Services, Failure>, BuildFailure<Failure>>
  > =>
    Effect.runPromise(
      Effect.gen(function* readyProgram() {
        generationSlot.generation ??= start();
        const { generation } = generationSlot;
        const exit = yield* Effect.promise(() => generation.build);
        if (Exit.isFailure(exit) && generationSlot.generation === generation) {
          delete generationSlot.generation;
        }
        return Exit.map(exit, () => generation.runtime);
      }),
    );
  return {
    built: ready,
    dispose: () => generationSlot.generation?.runtime.dispose() ?? Promise.resolve(),
    runPromise: (effect) =>
      Effect.runPromise(
        Effect.gen(function* runPromiseProgram() {
          const runtime = yield* Effect.promise(() => ready());
          if (Exit.isSuccess(runtime)) {
            return yield* Effect.promise(() => runtime.value.runPromise(effect));
          }
          return yield* Effect.failCause(runtime.cause);
        }),
      ),
    runPromiseExit: (effect) =>
      Effect.runPromise(
        Effect.gen(function* runPromiseExitProgram() {
          const runtime = yield* Effect.promise(() => ready());
          if (Exit.isSuccess(runtime)) {
            return yield* Effect.promise(() => runtime.value.runPromiseExit(effect));
          }
          return Exit.failCause(runtime.cause);
        }),
      ),
  };
};
export { workerRuntime };
export type { WorkerRuntime };
