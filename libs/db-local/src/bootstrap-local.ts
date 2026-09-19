import { reportFailed, runCli } from "@repo/cli";
import { Database } from "@repo/db";
import { EmailAddress, bootstrapAdmin } from "@repo/db/bootstrap";
import { Console, Effect, Schema } from "effect";

import { localDatabasePlatform } from "./local-platform.ts";

function failed(error: string): Readonly<Record<string, unknown>> {
  return { action: "admin_bootstrap", error, success: false };
}

runCli(
  Effect.gen(function* program() {
    const email = yield* Schema.decodeUnknownEffect(EmailAddress)(process.argv[2]);
    const { env } = yield* localDatabasePlatform;
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
