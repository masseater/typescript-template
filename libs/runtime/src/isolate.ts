import { Duration, Effect, Exit, Layer, Scope } from "effect";
import type { Context } from "effect";

interface IsolateRuntime<Services, Failure> {
  readonly dispose: () => Promise<void>;
  readonly runPromise: <Value, Error>(
    effect: Effect.Effect<Value, Error, Services>,
  ) => Promise<Value>;
  readonly runPromiseExit: <Value, Error>(
    effect: Effect.Effect<Value, Error, Services>,
  ) => Promise<Exit.Exit<Value, Error | Failure>>;
}

function isolateRuntime<Services, Failure>(
  layer: Layer.Layer<Services, Failure>,
): IsolateRuntime<Services, Failure> {
  const scope = Scope.makeUnsafe("parallel");
  let shared: Context.Context<Services> | undefined = undefined;
  const context = Effect.suspend(() =>
    shared === undefined
      ? Layer.buildWithScope(layer, scope).pipe(
          Effect.tap((built) =>
            Effect.sync(() => {
              shared ??= built;
            }),
          ),
        )
      : Effect.succeed(shared),
  );
  function provided<Value, Error>(
    effect: Effect.Effect<Value, Error, Services>,
  ): Effect.Effect<Value, Error | Failure> {
    return context.pipe(Effect.flatMap((built) => Effect.provideContext(effect, built)));
  }
  return {
    dispose: async () => {
      shared = undefined;
      await Effect.runPromise(Scope.close(scope, Exit.void));
    },
    runPromise: async (effect) => Effect.runPromise(provided(effect)),
    runPromiseExit: async (effect) => Effect.runPromiseExit(provided(effect)),
  };
}

function isolateCache<Value, Failure>(
  effect: Effect.Effect<Value, Failure>,
  window: Duration.Duration,
): Effect.Effect<Value, Failure> {
  const windowMillis = Duration.toMillis(window);
  interface Settled {
    readonly expiresAt: number;
    readonly exit: Exit.Exit<Value, Failure>;
  }
  let settled: Settled | undefined = undefined;
  return Effect.clockWith((clock) => {
    const cached = settled;
    if (cached !== undefined && clock.currentTimeMillisUnsafe() < cached.expiresAt) {
      return cached.exit;
    }
    return Effect.exit(effect).pipe(
      Effect.tap((exit) =>
        Effect.sync(() => {
          settled = { exit, expiresAt: clock.currentTimeMillisUnsafe() + windowMillis };
        }),
      ),
      Effect.flatten,
    );
  });
}

export { isolateCache, isolateRuntime };
export type { IsolateRuntime };
