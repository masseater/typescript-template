import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { runRemoteDatabaseCommand } from "@template/db/remote";
import { readStackOutput } from "@template/infra-bootstrap/state";
import { Effect, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";

const Settings = Schema.Struct({ accountId: Schema.String });

const inputInvalid = () => new CloudflareFailure({ code: "database_input_invalid" });

const readBootstrapEmail = Effect.tryPromise({
  try: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      if (!Buffer.isBuffer(chunk)) return Promise.reject(inputInvalid());
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8").trim();
  },
  catch: inputInvalid,
});

NodeRuntime.runMain(
  Effect.gen(function* () {
    const args = process.argv.slice(2);
    const shared = fileURLToPath(new URL("../shared", import.meta.url));
    const settings = yield* readStackOutput(shared, "applicationSettings").pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Settings)),
    );
    const databaseId = yield* readStackOutput(shared, "databaseId");
    const email = args[0] === "bootstrap" ? yield* readBootstrapEmail : "";
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const result = yield* runRemoteDatabaseCommand(args, {
      accountId: settings.accountId,
      databaseId,
      ...(args[1] === "--execute" && apiToken ? { apiToken } : {}),
      ...(email ? { email } : {}),
    });
    console.info(JSON.stringify(result));
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "cloudflare.database_command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
