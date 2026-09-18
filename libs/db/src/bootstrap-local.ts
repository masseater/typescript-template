import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";

import { EmailAddress, bootstrapAdmin } from "./bootstrap-statement.ts";
import { Database } from "./database.ts";
import { localPlatform } from "./local-platform.ts";

const report = (failureCode: string): Effect.Effect<void> => {
  return Console.error(
    JSON.stringify({ action: "admin_bootstrap", error: failureCode, success: false }),
  ).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  );
};

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const email = yield* Schema.decodeUnknownEffect(EmailAddress)(process.argv[2]);
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
      report("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN"),
    ),
    Effect.catchCause(() => report("LOCAL_BOOTSTRAP_FAILED")),
  ),
  { disableErrorReporting: true },
);
