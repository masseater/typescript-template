import { markFailed, runCli } from "@repo/cli";
import { layer } from "alchemy/Alchemist";
import { Console, Effect } from "effect";

import { blocked, inspectAccount } from "./account-inspection.ts";
import { deploymentAccess, stateStore } from "./deployment-access.ts";
import { causeRecord, reportCause } from "./secrets.ts";

const EVENT = "account.rejected";

runCli(
  Effect.gen(function* program() {
    const { access, confidential, config, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* inspected() {
      const inspection = yield* inspectAccount(access, config, stateStore(secrets));
      const refused = blocked(inspection);
      yield* Console.log(
        JSON.stringify({
          blocked: refused,
          checks: inspection,
          event: "account.inspected",
          ok: refused.length === 0,
        }),
      );
      if (refused.length > 0) {
        yield* markFailed;
      }
    }).pipe(
      Effect.provide(layer()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
