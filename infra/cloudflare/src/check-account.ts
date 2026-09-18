import { Console, Effect } from "effect";
import { blocked, inspectAccount } from "./account-inspection.ts";
import { deploymentAccess, stateStore } from "./deployment-access.ts";
import { markFailed, reportCause } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
import { layer } from "alchemy/Alchemist";

const EVENT = "account.rejected";

NodeRuntime.runMain(
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
      Effect.catchCause(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        (cause) => reportCause(EVENT, cause, confidential),
      ),
    );
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause(EVENT, cause),
    ),
  ),
  { disableErrorReporting: true },
);
