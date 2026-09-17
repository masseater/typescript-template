import { CloudflareFailure } from "./config.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { lookupDatabaseId } from "./database-lookup.ts";
import { runRemoteDatabaseCommand } from "@template/db/remote";
import { settings } from "./settings.ts";

function inputInvalid(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_input_invalid" });
}

const FIRST_USER_ARGUMENT_INDEX = 2;

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
    const config = yield* settings;
    // oxlint-disable-next-line node/no-process-env
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    if (apiToken === undefined || apiToken === "") {
      return yield* Effect.fail(inputInvalid());
    }
    const databaseId = yield* lookupDatabaseId({
      accountId: config.accountId,
      apiToken,
      name: `${config.prefix}-db`,
    });
    const email = args[0] === "bootstrap" ? yield* readBootstrapEmail : "";
    const result = yield* runRemoteDatabaseCommand(args, {
      accountId: config.accountId,
      databaseId,
      ...(args[1] === "--execute" ? { apiToken } : {}),
      ...(email === "" ? {} : { email }),
    });
    // oxlint-disable-next-line no-console
    console.info(JSON.stringify(result));
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.database_command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
