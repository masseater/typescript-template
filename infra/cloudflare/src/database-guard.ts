import { Effect, Schema } from "effect";
import { State, readState } from "alchemy/State";
import { databaseName, findDatabaseId } from "./database-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import type { DeploymentTarget } from "./config.ts";
import type { StateService } from "alchemy/State";
import { stackName } from "./stacks.ts";

type StateStore<Failure = never, Requirements = never> = Effect.Effect<
  StateService,
  Failure,
  Requirements
>;

const StoredDatabase = Schema.Struct({ attr: Schema.Struct({ databaseId: Schema.String }) });
const isStoredDatabase = Schema.is(StoredDatabase);

function nameTaken(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_name_taken", keys: ["TEMPLATE_PREFIX"] });
}

const databaseIdsInState = Effect.fn("databaseIdsInState")(function* databaseIdsInState<
  Failure,
  Requirements,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
>(store: StateStore<Failure, Requirements>, prefix: string) {
  const state = yield* store;
  return yield* readState({
    path: `${stackName("database")}/${prefix}`,
    recursive: true,
  }).pipe(
    Effect.provideService(State, Effect.succeed(state)),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((entries) =>
      entries.flatMap((entry) =>
        isStoredDatabase(entry.value) ? [entry.value.attr.databaseId] : [],
      ),
    ),
    Effect.catchTag("InvalidStatePath", () => Effect.succeed<readonly string[]>([])),
  );
});

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
    if ((yield* databaseIdsInState(store, target.prefix)).includes(existing)) {
      return;
    }
    return yield* Effect.fail(nameTaken());
  },
);

export { assertDatabaseUnclaimed };
export type { StateStore };
