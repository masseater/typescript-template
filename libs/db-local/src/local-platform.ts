import { localDatabaseStore, writeLocalDatabaseConfig } from "@repo/db/local";
import { Effect } from "effect";
import { getPlatformProxy } from "wrangler";

import type { D1Database } from "@cloudflare/workers-types";

const localDatabasePlatform = Effect.acquireRelease(
  Effect.gen(function* openPlatform() {
    const configPath = yield* Effect.promise(() => writeLocalDatabaseConfig());
    return yield* Effect.promise(() =>
      getPlatformProxy<{ DB: D1Database }>({
        configPath,
        envFiles: [],
        persist: { path: localDatabaseStore() },
        remoteBindings: false,
      }),
    );
  }),
  (proxy) => Effect.promise(() => proxy.dispose()),
);

export { localDatabasePlatform };
