import { checkDatabase } from "@repo/db";
import { Clock, Context, Duration, Effect, Layer } from "effect";

import type { Database, DatabaseFailure } from "@repo/db";
import type { Exit } from "effect";

const healthCacheWindow = Duration.minutes(1);

type DatabaseCheck = ReturnType<typeof checkDatabase>;
type CheckExit = Exit.Exit<Effect.Success<DatabaseCheck>, Effect.Error<DatabaseCheck>>;

interface DatabaseHealthShape {
  readonly check: Effect.Effect<void, DatabaseFailure>;
}

function isolateCheck(services: Context.Context<Database>): Effect.Effect<void, DatabaseFailure> {
  const isolate: { check?: Promise<CheckExit>; expiresAt: number } = { expiresAt: 0 };
  return Effect.gen(function* isolateCheckProgram() {
    const now = yield* Clock.currentTimeMillis;
    if (isolate.check === undefined || now >= isolate.expiresAt) {
      isolate.check = Effect.runPromiseExitWith(services)(checkDatabase());
      isolate.expiresAt = now + Duration.toMillis(healthCacheWindow);
    }
    const { check } = isolate;
    yield* yield* Effect.promise(async () => check);
  });
}

class DatabaseHealth extends Context.Service<DatabaseHealth, DatabaseHealthShape>()(
  "@repo/runtime/DatabaseHealth",
) {
  public static readonly layer: Layer.Layer<DatabaseHealth, never, Database> = Layer.effect(
    DatabaseHealth,
    Effect.gen(function* databaseHealthLayer() {
      const services = yield* Effect.context<Database>();
      return DatabaseHealth.of({ check: isolateCheck(services) });
    }),
  );
}

export { DatabaseHealth };
