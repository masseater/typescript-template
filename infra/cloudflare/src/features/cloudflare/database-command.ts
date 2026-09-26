#!/usr/bin/env node
import { Console, Effect } from "effect";

import { alchemistLayer } from "./alchemist.ts";
import { CloudflareFailure } from "./config.ts";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { databaseName, lookupDatabaseId } from "./database-lookup.ts";
import { runDeploymentCommand, stateStore } from "./deployment-access.ts";
import { encodeJson } from "./platform.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const EVENT = "cloudflare.database_command_rejected";

function inputInvalid(): CloudflareFailure {
  return CloudflareFailure.make({ code: "database_input_invalid", keys: [] });
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

runDeploymentCommand(
  EVENT,
  Effect.sync(() => process.argv.slice(FIRST_USER_ARGUMENT_INDEX)),
  (args, { access, config, secrets }) =>
    Effect.gen(function* owned() {
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
    }).pipe(Effect.provide(alchemistLayer()), Effect.scoped),
);
