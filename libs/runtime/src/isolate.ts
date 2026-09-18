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

const disposedRuntime = "the runtime of this isolate was disposed";

function isolateRuntime<Services, Failure>(
  layer: Layer.Layer<Services, Failure>,
): IsolateRuntime<Services, Failure> {
  const scope = Scope.makeUnsafe("parallel");
  let shared: Context.Context<Services> | undefined = undefined;
  let disposed = false;
  function published(
    attempt: Scope.Closeable,
    built: Context.Context<Services>,
  ): Effect.Effect<Context.Context<Services>> {
    return Effect.suspend(() => {
      const won = shared;
      if (won !== undefined) {
        return Scope.close(attempt, Exit.void).pipe(Effect.as(won));
      }
      shared = built;
      return Effect.succeed(built);
    });
  }
  function attempted(attempt: Scope.Closeable): Effect.Effect<Context.Context<Services>, Failure> {
    return Layer.buildWithScope(layer, attempt).pipe(
      Effect.flatMap((built) => published(attempt, built)),
      Effect.onExit((exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(attempt, exit))),
    );
  }
  const context = Effect.suspend(() => {
    if (disposed) {
      return Effect.die(disposedRuntime);
    }
    return shared === undefined
      ? attempted(Scope.forkUnsafe(scope, "sequential"))
      : Effect.succeed(shared);
  });
  function provided<Value, Error>(
    effect: Effect.Effect<Value, Error, Services>,
  ): Effect.Effect<Value, Error | Failure> {
    return context.pipe(Effect.flatMap((built) => Effect.provideContext(effect, built)));
  }
  return {
    dispose: async (): Promise<void> => {
      disposed = true;
      shared = undefined;
      await Effect.runPromise(Scope.close(scope, Exit.void));
    },
    runPromise: async (effect) => Effect.runPromise(provided(effect)),
    runPromiseExit: async (effect) => Effect.runPromiseExit(provided(effect)),
  };
}

interface Settled<Value, Failure> {
  readonly expiresAt: number;
  readonly exit: Exit.Exit<Value, Failure>;
  readonly startedAt: number;
}

function isolateCache<Value, Failure>(
  effect: Effect.Effect<Value, Failure>,
  window: Duration.Duration,
): Effect.Effect<Value, Failure> {
  const windowMillis = Duration.toMillis(window);
  let settled: Settled<Value, Failure> | undefined = undefined;
  function keep(
    exit: Exit.Exit<Value, Failure>,
    startedAt: number,
    settledAt: number,
  ): Effect.Effect<void> {
    return Effect.sync(() => {
      const kept = settled;
      if (Exit.hasInterrupts(exit) || (kept !== undefined && kept.startedAt > startedAt)) {
        return;
      }
      settled = { exit, expiresAt: settledAt + windowMillis, startedAt };
    });
  }
  return Effect.clockWith((clock) => {
    const cached = settled;
    const startedAt = clock.currentTimeMillisUnsafe();
    if (cached !== undefined && startedAt < cached.expiresAt) {
      return cached.exit;
    }
    return Effect.exit(effect).pipe(
      Effect.tap((exit) => keep(exit, startedAt, clock.currentTimeMillisUnsafe())),
      Effect.flatten,
    );
  });
}

export { disposedRuntime, isolateCache, isolateRuntime };
export type { IsolateRuntime };
