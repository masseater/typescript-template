import { Clock, Context, Duration, Effect, Layer } from "effect";

import { ensureCoreReady, type Core, type CoreReadyError } from "./core.ts";

import type { Exit } from "effect";

const healthCacheWindow = Duration.minutes(1);

type ReadyCheck = ReturnType<typeof ensureCoreReady>;
type CheckExit = Exit.Exit<Effect.Success<ReadyCheck>, Effect.Error<ReadyCheck>>;

interface CoreHealthShape {
  readonly check: Effect.Effect<void, CoreReadyError>;
}

function isolateCheck(services: Context.Context<Core>): Effect.Effect<void, CoreReadyError> {
  const isolate: { check?: Promise<CheckExit>; expiresAt: number } = { expiresAt: 0 };
  return Effect.gen(function* isolateCheckProgram() {
    const now = yield* Clock.currentTimeMillis;
    if (isolate.check === undefined || now >= isolate.expiresAt) {
      isolate.check = Effect.runPromiseExitWith(services)(ensureCoreReady());
      isolate.expiresAt = now + Duration.toMillis(healthCacheWindow);
    }
    const { check } = isolate;
    yield* yield* Effect.promise(() => check);
  });
}

class CoreHealth extends Context.Service<CoreHealth, CoreHealthShape>()(
  "@repo/runtime/CoreHealth",
) {
  public static readonly layer: Layer.Layer<CoreHealth, never, Core> = Layer.effect(
    CoreHealth,
    Effect.gen(function* coreHealthLayer() {
      const services = yield* Effect.context<Core>();
      return CoreHealth.of({ check: isolateCheck(services) });
    }),
  );
}

export { CoreHealth };
