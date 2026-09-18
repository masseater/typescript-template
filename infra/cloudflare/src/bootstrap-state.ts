import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { secretsStoreCount, stateStorePresent } from "./account-lookup.ts";
import { AlchemyFailure, runAlchemy } from "./alchemy-cli.ts";
import { CloudflareFailure } from "./config.ts";
import { deploymentAccess } from "./deployment-access.ts";
import { OK_EXIT_CODE, reportCause } from "./secrets.ts";

import type { AccountAccess } from "./account-read.ts";

const EVENT = "cloudflare.state_store_rejected";

const ADOPT_FLAG = "--adopt-account-state";

const assertAccountUnused = Effect.fn("assertAccountUnused")(function* assertAccountUnused(
  access: AccountAccess,
) {
  if (yield* stateStorePresent(access)) {
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

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const adopting = process.argv.includes(ADOPT_FLAG);
    const { access, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* bootstrap() {
      if (!adopting) {
        yield* assertAccountUnused(access);
      }
      const args = ["provider", "cloudflare", "bootstrap", "--env-file", secrets.filename];
      if ((yield* runAlchemy(args, confidential)) !== OK_EXIT_CODE) {
        return yield* Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" }));
      }

      console.info(JSON.stringify({ adopted: adopting, event: "cloudflare.state_store_ready" }));
    }).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)));
  }).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause))),
  { disableErrorReporting: true },
);
