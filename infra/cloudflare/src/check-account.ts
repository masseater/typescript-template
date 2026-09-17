import { reportCause, withVerifiedSecrets } from "./secrets.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { assertDatabaseNameFree } from "./database-guard.ts";
import { settings } from "./settings.ts";
import { verifiedSecrets } from "./credentials.ts";

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const secrets = yield* verifiedSecrets();
    const config = yield* withVerifiedSecrets(secrets, settings);
    yield* assertDatabaseNameFree(secrets, config);
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ databaseAlreadyExists: false, event: "account.inspected" }));
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("account.rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
