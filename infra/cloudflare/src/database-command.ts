#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { layer } from "alchemy/Alchemist";
import { Console, Effect } from "effect";

import { CloudflareFailure } from "./config.ts";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { databaseName, lookupDatabaseId } from "./database-lookup.ts";
import { deploymentAccess, stateStore } from "./deployment-access.ts";
import { encodeJson } from "./platform.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { causeRecord, reportCause } from "./secrets.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const EVENT = "cloudflare.database_command_rejected";

function inputInvalid(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_input_invalid", keys: [] });
}

const readBootstrapEmail = Effect.callback<string, CloudflareFailure>((resume) => {
  const chunks: Buffer[] = [];
  process.stdin.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  process.stdin.on("error", () => {
    resume(inputInvalid());
  });
  process.stdin.on("end", () => {
    resume(Effect.succeed(Buffer.concat(chunks).toString("utf-8").trim()));
  });
});

runCli(
  Effect.gen(function* program() {
    const args = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
    const { access, confidential, config, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* owned() {
      yield* assertDatabaseUnclaimed(access, config, stateStore(secrets));
      const databaseId = yield* lookupDatabaseId(access, databaseName(config.prefix));
      const email = args[0] === "bootstrap" ? yield* readBootstrapEmail : "";
      const result = yield* runRemoteDatabaseCommand(args, {
        accountId: access.accountId,
        apiToken: access.apiToken,
        databaseId,
        ...(email === "" ? {} : { email }),
      });
      yield* Console.info(yield* encodeJson(result));
    }).pipe(
      Effect.provide(layer()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
