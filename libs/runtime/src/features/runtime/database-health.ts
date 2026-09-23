import { checkDatabase, type Database, type DatabaseFailure } from "@repo/db";
import { Clock, Context, Duration, Effect, Layer, type Exit } from "effect";
const healthCacheWindow = Duration.minutes(1);
type DatabaseCheck = ReturnType<typeof checkDatabase>;
const isolateCheck = (
  services: Context.Context<Database>,
): Effect.Effect<void, DatabaseFailure> => {
  const isolate: {
    check?: Promise<Exit.Exit<Effect.Success<DatabaseCheck>, Effect.Error<DatabaseCheck>>>;
    expiresAt: number;
  } = { expiresAt: 0 };
  return Effect.gen(function* isolateCheckProgram() {
    const clockInstant = yield* Clock.currentTimeMillis;
    if (isolate.check === undefined || clockInstant >= isolate.expiresAt) {
      isolate.check = Effect.runPromiseExitWith(services)(checkDatabase());
      isolate.expiresAt = clockInstant + Duration.toMillis(healthCacheWindow);
    }
    const { check } = isolate;
    yield* yield* Effect.promise(() => check);
  });
};
class DatabaseHealth extends Context.Service<
  DatabaseHealth,
  {
    readonly check: Effect.Effect<void, DatabaseFailure>;
  }
>()("@repo/runtime/DatabaseHealth") {
  public static readonly layer: Layer.Layer<DatabaseHealth, never, Database> = Layer.effect(
    DatabaseHealth,
    Effect.gen(function* databaseHealthLayer() {
      const services = yield* Effect.context<Database>();
      return DatabaseHealth.of({ check: isolateCheck(services) });
    }),
  );
}
export { DatabaseHealth };
