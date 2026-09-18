import type { D1Database } from "@cloudflare/workers-types";
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { getPlatformProxy } from "wrangler";

import { localDatabaseStore, writeLocalDatabaseConfig } from "./local.ts";
import { migrateD1 } from "./migrate-d1.ts";

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      configPath: await writeLocalDatabaseConfig(),
      envFiles: [],
      persist: { path: localDatabaseStore },
      remoteBindings: false,
    }),
  ),
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  (proxy) => Effect.promise(async () => proxy.dispose()),
);

function report(error: string): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ action: "local_migration", error, success: false }));
    process.exitCode = 1;
  });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { env } = yield* platform;
    const applied = yield* migrateD1(env.DB);
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("RemoteFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("LOCAL_MIGRATION_FAILED")),
  ),
  { disableErrorReporting: true },
);
