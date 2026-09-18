import { databaseName, findDatabaseId } from "./database-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import type { DeploymentTarget } from "./config.ts";
import { Effect } from "effect";
import type { StateStore } from "./state-ownership.ts";
import { recordedDatabaseIds } from "./state-ownership.ts";

function nameTaken(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_name_taken", keys: ["TEMPLATE_PREFIX"] });
}

const assertDatabaseUnclaimed = Effect.fn("assertDatabaseUnclaimed")(
  function* assertDatabaseUnclaimed<Failure, Requirements>(
    access: AccountAccess,
    target: DeploymentTarget,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    store: StateStore<Failure, Requirements>,
  ) {
    const existing = yield* findDatabaseId(access, databaseName(target.prefix));
    if (existing === undefined) {
      return;
    }
    if ((yield* recordedDatabaseIds(store, target.prefix)).includes(existing)) {
      return;
    }
    return yield* Effect.fail(nameTaken());
  },
);

export { assertDatabaseUnclaimed };
