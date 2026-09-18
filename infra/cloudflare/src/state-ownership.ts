import { Effect, Schema } from "effect";
import { State, readState } from "alchemy/State";
import { stackName, stackNames } from "./stacks.ts";
import type { StackName } from "./stacks.ts";
import type { StateService } from "alchemy/State";

const StoredDatabase = Schema.Struct({ attr: Schema.Struct({ databaseId: Schema.String }) });
const StoredWorker = Schema.Struct({ attr: Schema.Struct({ workerName: Schema.String }) });
const isStoredDatabase = Schema.is(StoredDatabase);
const isStoredWorker = Schema.is(StoredWorker);

const recordedRows = Effect.fn("recordedRows")(function* recordedRows<Failure, Requirements>(
  store: Effect.Effect<StateService, Failure, Requirements>,
  prefix: string,
  stacks: readonly StackName[],
) {
  const state = yield* store;
  const found = yield* Effect.forEach(stacks, (stack) =>
    readState({ path: `${stackName(stack)}/${prefix}`, recursive: true }).pipe(
      Effect.provideService(State, Effect.succeed(state)),
      Effect.map((entries) => entries.map((entry) => entry.value)),
      Effect.catchTag("InvalidStatePath", () => Effect.succeed<readonly unknown[]>([])),
    ),
  );
  return found.flat();
});

const recordedDatabaseIds = Effect.fn("recordedDatabaseIds")(function* recordedDatabaseIds<
  Failure,
  Requirements,
>(store: Effect.Effect<StateService, Failure, Requirements>, prefix: string) {
  const rows = yield* recordedRows(store, prefix, ["database"]);
  return rows.flatMap((row) => (isStoredDatabase(row) ? [row.attr.databaseId] : []));
});

const recordedWorkerNames = Effect.fn("recordedWorkerNames")(function* recordedWorkerNames<
  Failure,
  Requirements,
>(store: Effect.Effect<StateService, Failure, Requirements>, prefix: string) {
  const rows = yield* recordedRows(store, prefix, stackNames);
  return rows.flatMap((row) => (isStoredWorker(row) ? [row.attr.workerName] : []));
});

export { recordedDatabaseIds, recordedWorkerNames };
