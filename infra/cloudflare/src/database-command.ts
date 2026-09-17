import { Effect, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { readStackOutput } from "@template/infra-bootstrap/state";
import { runRemoteDatabaseCommand } from "@template/db/remote";

const Settings = Schema.Struct({ accountId: Schema.String });

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
    const settings = yield* readStackOutput(
      fileURLToPath(new URL("../settings", import.meta.url)),
      "applicationSettings",
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Settings)));
    const databaseId = yield* readStackOutput(
      fileURLToPath(new URL("../database", import.meta.url)),
      "databaseId",
    );
    const email = args[0] === "bootstrap" ? yield* readBootstrapEmail : "";
    // oxlint-disable-next-line node/no-process-env
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const result = yield* runRemoteDatabaseCommand(args, {
      accountId: settings.accountId,
      databaseId,
      ...(args[1] === "--execute" && apiToken !== undefined && apiToken !== "" ? { apiToken } : {}),
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
