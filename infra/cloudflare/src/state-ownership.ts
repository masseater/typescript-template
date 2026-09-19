import { State, readState } from "alchemy/State";
import { Effect, Schema } from "effect";

import { stackName, stackNames, traceDestinationStack } from "./stacks.ts";

import type { StateService } from "alchemy/State";
import type { StackName } from "./stacks.ts";

const StoredDatabase = Schema.Struct({ attr: Schema.Struct({ databaseId: Schema.String }) });
const StoredWorker = Schema.Struct({ attr: Schema.Struct({ workerName: Schema.String }) });
const StoredSending = Schema.Struct({
  attr: Schema.Struct({ name: Schema.String, zoneId: Schema.String }),
});
const StoredTraceDestination = Schema.Struct({
  attr: Schema.Struct({ name: Schema.String, slug: Schema.String }),
});
const isStoredDatabase = Schema.is(StoredDatabase);
const isStoredWorker = Schema.is(StoredWorker);
const isStoredSending = Schema.is(StoredSending);
const isStoredTraceDestination = Schema.is(StoredTraceDestination);

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
      Effect.catchTag("InvalidStatePath", (error) =>
        error.reason === "path does not exist"
          ? Effect.succeed<readonly unknown[]>([])
          : Effect.fail(error),
      ),
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

const recordedSendingDomains = Effect.fn("recordedSendingDomains")(function* recordedSendingDomains<
  Failure,
  Requirements,
>(store: Effect.Effect<StateService, Failure, Requirements>, prefix: string, zoneId: string) {
  const rows = yield* recordedRows(store, prefix, ["email"]);
  return rows.flatMap((row) =>
    isStoredSending(row) && row.attr.zoneId === zoneId ? [row.attr.name] : [],
  );
});

const recordedTraceDestinations = Effect.fn("recordedTraceDestinations")(
  function* recordedTraceDestinations<Failure, Requirements>(
    store: Effect.Effect<StateService, Failure, Requirements>,
    prefix: string,
  ) {
    const rows = yield* recordedRows(store, prefix, [traceDestinationStack]);
    return rows.flatMap((row) => (isStoredTraceDestination(row) ? [row.attr.name] : []));
  },
);

export {
  recordedDatabaseIds,
  recordedSendingDomains,
  recordedTraceDestinations,
  recordedWorkerNames,
};
