import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect } from "effect";

import { isUnreadable, readVerdict, unreadableState } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import { databaseName, findDatabaseId } from "./database-lookup.ts";
import { recordedDatabaseIds } from "./state-ownership.ts";

import type { StateService } from "alchemy/State";
import type { AccountAccess } from "./account-read.ts";
import type { DeploymentTarget } from "./config.ts";

function nameTaken(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_name_taken", keys: [deploymentKey.prefix] });
}

const databaseVerdict = Effect.fn("databaseVerdict")(function* databaseVerdict<
  Failure,
  Requirements,
>(
  access: AccountAccess,
  target: DeploymentTarget,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  const existing = yield* findDatabaseId(access, databaseName(target.prefix));
  if (existing === undefined) {
    return "free" as const;
  }
  const recorded = yield* recordedDatabaseIds(store, target.prefix).pipe(
    Effect.catch(unreadableState),
  );
  return readVerdict(recorded, (ids): "owned" | "taken" =>
    ids.includes(existing) ? "owned" : "taken",
  );
});

const assertDatabaseUnclaimed = Effect.fn("assertDatabaseUnclaimed")(
  function* assertDatabaseUnclaimed<Failure, Requirements>(
    access: AccountAccess,
    target: DeploymentTarget,
    store: Effect.Effect<StateService, Failure, Requirements>,
  ) {
    const verdict = yield* databaseVerdict(access, target, store);
    if (isUnreadable(verdict)) {
      return yield* new CloudflareFailure({
        code: "account_read_unavailable",
        keys: verdict.unreadable,
      });
    }
    if (verdict === "taken") {
      return yield* nameTaken();
    }
  },
);

export { assertDatabaseUnclaimed, databaseVerdict };
