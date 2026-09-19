import { localDatabaseStore, writeLocalDatabaseConfig } from "@repo/db/local";
import { Effect } from "effect";
import { getPlatformProxy } from "wrangler";

import type { D1Database } from "@cloudflare/workers-types";

const localDatabasePlatform = Effect.acquireRelease(
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

export { localDatabasePlatform };
