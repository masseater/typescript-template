#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/cli";
import { Database } from "@repo/db";
import { BOOTSTRAP_KIND, BootstrapKind, Email, bootstrapAdmin } from "@repo/db/bootstrap";
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
    const bootstrapKind = yield* Schema.decodeUnknownEffect(BootstrapKind)(
      process.argv[3] ?? BOOTSTRAP_KIND.admin,
    );
    const { env } = yield* localDatabasePlatform;
    const promoted = yield* bootstrapAdmin(email, bootstrapKind).pipe(
      Effect.provide(Database.layer(env.DB)),
    );
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        action: "admin_bootstrap",
        permission: promoted.permission,
        role: promoted.role,
        userId: promoted.id,
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
