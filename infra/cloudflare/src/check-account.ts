import { Config, Effect, Redacted } from "effect";
import { reportCause, reportRejection, withVerifiedSecrets } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
import { findDatabaseId } from "./database-lookup.ts";
import { settings } from "./settings.ts";
import { verifiedSecrets } from "./credentials.ts";

const apiToken = Config.redacted("CLOUDFLARE_API_TOKEN");

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const secrets = yield* verifiedSecrets();
    const config = yield* withVerifiedSecrets(secrets, settings);
    const token = yield* withVerifiedSecrets(secrets, apiToken);
    const existing = yield* findDatabaseId({
      accountId: config.accountId,
      apiToken: Redacted.value(token),
      name: `${config.prefix}-db`,
    });
    // oxlint-disable-next-line no-console
    console.log(
      JSON.stringify({ databaseAlreadyExists: existing !== undefined, event: "account.inspected" }),
    );
    if (existing !== undefined) {
      yield* reportRejection("account.rejected", {
        code: "database_name_taken",
        keys: ["TEMPLATE_PREFIX"],
      });
    }
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("account.rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
