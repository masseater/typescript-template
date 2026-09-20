#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";
import { getPlatformProxy } from "wrangler";

import { EmailAddress, bootstrapAdmin } from "./bootstrap-statement.ts";
import { Database } from "./database.ts";
import { localDatabaseStore, writeLocalDatabaseConfig } from "./local.ts";

import type { D1Database } from "@cloudflare/workers-types";

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      configPath: await writeLocalDatabaseConfig(),
      envFiles: [],
      persist: { path: localDatabaseStore() },
      remoteBindings: false,
    }),
  ),
  (proxy) => Effect.promise(async () => proxy.dispose()),
);

function failed(error: string): Readonly<Record<string, unknown>> {
  return { action: "admin_bootstrap", error, success: false };
}

runCli(
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
      reportFailed(failed("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN")),
    ),
  ),
  failed("LOCAL_BOOTSTRAP_FAILED"),
);
