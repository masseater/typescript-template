#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";

import { Email, bootstrapAdmin } from "./bootstrap-statement.ts";
import { Database } from "./database.ts";
import { localPlatform } from "./local-platform.ts";

const failed = (failureCode: string): Readonly<Record<string, unknown>> => ({
  action: "admin_bootstrap",
  error: failureCode,
  success: false,
});

runCli(
  Effect.gen(function* program() {
    const email = yield* Schema.decodeUnknownEffect(Email)(process.argv[2]);
    const { env } = yield* localPlatform;
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
