#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/cli";
import { Database } from "@repo/db";
import { Email, bootstrapAdmin } from "@repo/db/bootstrap";
import { Cause, Console, Effect, Schema } from "effect";

import { localDatabasePlatform } from "./local-platform.ts";

const failed = (failureCode: string): Readonly<Record<string, unknown>> => ({
  action: "admin_bootstrap",
  error: failureCode,
  success: false,
});

runCli(
  Effect.gen(function* program() {
    const email = yield* Schema.decodeUnknownEffect(Email)(process.argv[2]);
    const { env } = yield* localDatabasePlatform;
    const administrator = yield* bootstrapAdmin(email).pipe(Effect.provide(Database.layer(env.DB)));
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
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
  (cause) => ({ ...failed("LOCAL_BOOTSTRAP_FAILED"), cause: Cause.pretty(cause) }),
);
