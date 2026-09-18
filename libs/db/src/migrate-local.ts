import { reportFailed, runCli } from "@repo/config/cli";
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

function failed(error: string): Readonly<Record<string, unknown>> {
  return { action: "local_migration", error, success: false };
}

runCli(
  Effect.gen(function* program() {
    const { env } = yield* platform;
    const applied = yield* migrateD1(env.DB);
    yield* Console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("RemoteFailure", (failure) => reportFailed(failed(failure.code))),
  ),
  failed("LOCAL_MIGRATION_FAILED"),
);
