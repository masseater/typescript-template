import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";
import type { D1Database } from "@cloudflare/workers-types";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { getPlatformProxy } from "wrangler";
import { migrateD1 } from "./migrate-d1.ts";

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      configPath: await writeLocalDatabaseConfig(),
      envFiles: [],
      persist: { path: `${localDatabasePersistence}/v3` },
      remoteBindings: false,
    }),
  ),
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  (proxy) => Effect.promise(async () => proxy.dispose()),
);

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { env } = yield* platform;
    const applied = yield* migrateD1(env.DB);
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ action: "local_migration", success: false }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
