import { Config, Effect, Redacted } from "effect";
import { reportCause, withVerifiedSecrets } from "./secrets.ts";
import { CloudflareFailure } from "./config.ts";
import { NodeRuntime } from "@effect/platform-node";
import { lookupDatabaseId } from "./database-lookup.ts";
import { runRemoteDatabaseCommand } from "@template/db/remote";
import { settings } from "./settings.ts";
import { verifiedSecrets } from "./credentials.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;

const apiToken = Config.redacted("CLOUDFLARE_API_TOKEN");

function inputInvalid(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_input_invalid", keys: [] });
}

const readBootstrapEmail = Effect.tryPromise({
  catch: inputInvalid,
  try: async () => {
    const chunks: unknown[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return chunks;
  },
}).pipe(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  Effect.flatMap((chunks) =>
    chunks.every((chunk) => Buffer.isBuffer(chunk))
      ? Effect.succeed(Buffer.concat(chunks).toString("utf-8").trim())
      : Effect.fail(inputInvalid()),
  ),
);

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const args = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
    const secrets = yield* verifiedSecrets();
    const config = yield* withVerifiedSecrets(secrets, settings);
    const token = Redacted.value(yield* withVerifiedSecrets(secrets, apiToken));
    const databaseId = yield* lookupDatabaseId({
      accountId: config.accountId,
      apiToken: token,
      name: `${config.prefix}-db`,
    });
    const email = args[0] === "bootstrap" ? yield* readBootstrapEmail : "";
    const result = yield* runRemoteDatabaseCommand(args, {
      accountId: config.accountId,
      apiToken: token,
      databaseId,
      ...(email === "" ? {} : { email }),
    });
    // oxlint-disable-next-line no-console
    console.info(JSON.stringify(result));
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("cloudflare.database_command_rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
