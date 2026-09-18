import { Context, Duration, Effect, Layer } from "effect";

import { Database, checkDatabase } from "@repo/db";
import type { DatabaseFailure } from "@repo/db";

import { isolateCache } from "./isolate.ts";

const healthCacheWindow = Duration.minutes(1);

interface DatabaseHealthShape {
  readonly check: Effect.Effect<void, DatabaseFailure>;
}

class DatabaseHealth extends Context.Service<DatabaseHealth, DatabaseHealthShape>()(
  "@repo/runtime/DatabaseHealth",
) {
  public static readonly layer: Layer.Layer<DatabaseHealth, never, Database> = Layer.effect(
    DatabaseHealth,
    Effect.gen(function* databaseHealthLayer() {
      const database = yield* Database;
      const read = Effect.provideService(checkDatabase(), Database, database);
      return DatabaseHealth.of({ check: isolateCache(read, healthCacheWindow) });
    }),
  );
}

export { DatabaseHealth, healthCacheWindow };
