#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import { secretsStoreCount, workerNames } from "./account-lookup.ts";
import { AlchemyFailure, runAlchemy } from "./alchemy-cli.ts";
import { CloudflareFailure } from "./config.ts";
import { STATE_STORE_SCRIPT_NAME } from "./deploy-token.ts";
import { deploymentAccess } from "./deployment-access.ts";
import { OK_EXIT_CODE, causeRecord, reportCause } from "./secrets.ts";

import type { AccountAccess } from "./account-read.ts";
import type { AlchemyCommand } from "./alchemy-cli.ts";

const ADOPT_FLAG = "--adopt-account-state";
const EVENT = "cloudflare.state_store_rejected";

const assertAccountUnused = Effect.fn("assertAccountUnused")(function* assertAccountUnused(
  access: AccountAccess,
) {
  if ((yield* workerNames(access)).includes(STATE_STORE_SCRIPT_NAME)) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "state_store_name_taken", keys: [ADOPT_FLAG] }),
    );
  }
  if ((yield* secretsStoreCount(access)) > 0) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "secrets_store_already_present", keys: [ADOPT_FLAG] }),
    );
  }
});

runCli(
  Effect.gen(function* program() {
    const adopting = process.argv.includes(ADOPT_FLAG);
    const { access, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* bootstrap() {
      if (!adopting) {
        yield* assertAccountUnused(access);
      }
      const args: AlchemyCommand = [
        "provider",
        "cloudflare",
        "bootstrap",
        "--env-file",
        secrets.filename,
      ];
      if ((yield* runAlchemy(args, confidential)) !== OK_EXIT_CODE) {
        return yield* Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" }));
      }
      yield* Console.info(
        JSON.stringify({ adopted: adopting, event: "cloudflare.state_store_ready" }),
      );
    }).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)));
  }),
  (cause) => causeRecord(EVENT, cause),
);
