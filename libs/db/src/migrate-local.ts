import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { getPlatformProxy } from "wrangler";

import { localDatabaseStore, writeLocalDatabaseConfig } from "./local.ts";
import { migrateD1 } from "./migrate-d1.ts";

import type { D1Database } from "@cloudflare/workers-types";

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      configPath: await writeLocalDatabaseConfig(),
      envFiles: [],
      persist: { path: localDatabaseStore },
      remoteBindings: false,
    }),
  ),
  (proxy) => Effect.promise(async () => proxy.dispose()),
);

const report = (error: string): Effect.Effect<void> => {
  return Console.error(JSON.stringify({ action: "local_migration", error, success: false })).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  );
};

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { env } = yield* platform;
    const applied = yield* migrateD1(env.DB);
    yield* Console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("RemoteFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("LOCAL_MIGRATION_FAILED")),
  ),
  { disableErrorReporting: true },
);
