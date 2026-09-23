import { readMigrationStatus } from "@repo/db/migrations";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect } from "effect";

import { isUnreadable, readVerdict, unreadableState } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import { databaseName, findDatabaseId, lookupDatabaseId } from "./database-lookup.ts";
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

const assertDatabaseMigrated = Effect.fn("assertDatabaseMigrated")(function* assertDatabaseMigrated(
  access: AccountAccess,
  target: DeploymentTarget,
) {
  const databaseId = yield* lookupDatabaseId(access, databaseName(target.prefix));
  const status = yield* readMigrationStatus({
    accountId: access.accountId,
    apiToken: access.apiToken,
    databaseId,
  }).pipe(
    Effect.mapError(
      (failure) =>
        new CloudflareFailure({
          code: "database_migration_status_unreadable",
          keys: [failure.code],
        }),
    ),
  );
  if (status.state === "unrecorded") {
    return yield* new CloudflareFailure({
      code: "database_migration_history_missing",
      keys: [String(status.declared)],
    });
  }
  if (status.pending > 0) {
    return yield* new CloudflareFailure({
      code: "database_migrations_pending",
      keys: [String(status.applied), String(status.declared)],
    });
  }
});

export { assertDatabaseMigrated, assertDatabaseUnclaimed, databaseVerdict };
