import { NodeRuntime } from "@effect/platform-node";
import type { D1Database } from "@cloudflare/workers-types";
import { Effect, Schema } from "effect";
import { getPlatformProxy } from "wrangler";
import { bootstrapAdmin } from "./admin.ts";
import { EmailAddress } from "./bootstrap-statement.ts";
import { Database } from "./index.ts";
import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      remoteBindings: false,
      envFiles: [],
      configPath: await writeLocalDatabaseConfig(),
      persist: { path: `${localDatabasePersistence}/v3` },
    }),
  ),
  (proxy) => Effect.promise(() => proxy.dispose()),
);

const report = (error: string) =>
  Effect.sync(() => {
    console.error(JSON.stringify({ action: "admin_bootstrap", success: false, error }));
    process.exitCode = 1;
  });

NodeRuntime.runMain(
  Effect.gen(function* () {
    const email = yield* Schema.decodeUnknownEffect(EmailAddress)(process.argv[2]);
    const { env } = yield* platform;
    const administrator = yield* bootstrapAdmin(email).pipe(Effect.provide(Database.layer(env.DB)));
    console.log(
      JSON.stringify({
        action: "admin_bootstrap",
        userId: administrator.id,
        role: administrator.role,
      }),
    );
  }).pipe(
    Effect.scoped,
    Effect.catchTag("BootstrapUnavailable", () =>
      report("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN"),
    ),
    Effect.catchCause(() => report("LOCAL_BOOTSTRAP_FAILED")),
  ),
  { disableErrorReporting: true },
);
