import type { D1Database } from "@cloudflare/workers-types";
import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";
import { getPlatformProxy } from "wrangler";

import { reportFailed } from "@repo/config/cli";

import { EmailAddress, bootstrapAdmin } from "./bootstrap-statement.ts";
import { Database } from "./database.ts";
import { localDatabaseStore, writeLocalDatabaseConfig } from "./local.ts";

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

function report(error: string): Effect.Effect<void> {
  return reportFailed({ action: "admin_bootstrap", error, success: false });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const email = yield* Schema.decodeUnknownEffect(EmailAddress)(process.argv[2]);
    const { env } = yield* platform;
    const administrator = yield* bootstrapAdmin(email).pipe(Effect.provide(Database.layer(env.DB)));
    yield* Console.log(
      JSON.stringify({
        action: "admin_bootstrap",
        role: administrator.role,
        userId: administrator.id,
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
