import { Effect } from "effect";
import { getPlatformProxy } from "wrangler";

import { localDatabaseStore, writeLocalDatabaseConfig } from "./local.ts";

import type { D1Database } from "@cloudflare/workers-types";

export const localPlatform = Effect.acquireRelease(
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
