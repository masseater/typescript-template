import type { StateService } from "alchemy/State";
import { Effect } from "effect";

import { readMigrationStatus } from "@repo/db/migrations";

import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import type { DeploymentTarget } from "./config.ts";
import { databaseName, findDatabaseId, lookupDatabaseId } from "./database-lookup.ts";
import { recordedDatabaseIds } from "./state-ownership.ts";

function nameTaken(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_name_taken", keys: ["TEMPLATE_PREFIX"] });
}

const assertDatabaseUnclaimed = Effect.fn("assertDatabaseUnclaimed")(
  function* assertDatabaseUnclaimed<Failure, Requirements>(
    access: AccountAccess,
    target: DeploymentTarget,
    store: Effect.Effect<StateService, Failure, Requirements>,
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

const databaseVerdict = Effect.fn("databaseVerdict")(function* databaseVerdict<
  Failure,
  Requirements,
>(
  access: AccountAccess,
  target: DeploymentTarget,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  if ((yield* findDatabaseId(access, databaseName(target.prefix))) === undefined) {
    return "free" as const;
  }
  return yield* assertDatabaseUnclaimed(access, target, store).pipe(
    Effect.as("owned" as const),
    Effect.catchCause(() => Effect.succeed("taken" as const)),
  );
});

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
  if (status.pending > 0) {
    return yield* Effect.fail(
      new CloudflareFailure({
        code: "database_migrations_pending",
        keys: [String(status.applied), String(status.declared)],
      }),
    );
  }
});

export { assertDatabaseMigrated, assertDatabaseUnclaimed, databaseVerdict };
