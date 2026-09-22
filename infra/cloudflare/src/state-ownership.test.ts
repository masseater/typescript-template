import { assert, it } from "@effect/vitest";
import { InMemoryService } from "alchemy/State";
import { Effect } from "effect";

import { recordedDatabaseIds, recordedWorkerNames } from "./state-ownership.ts";
import { verificationSettings } from "./verification-fixture.ts";

const prefix = verificationSettings.prefix;

it.effect("fails when a path the store has never held rather than inventing empty ownership", () =>
  Effect.gen(function* program() {
    const store = InMemoryService({});
    const workers = yield* recordedWorkerNames(store, prefix).pipe(Effect.flip);
    if (workers._tag !== "InvalidStatePath") {
      return yield* Effect.die(workers);
    }
    assert.strictEqual(workers.reason, "path does not exist");
    const databases = yield* recordedDatabaseIds(store, prefix).pipe(Effect.flip);
    if (databases._tag !== "InvalidStatePath") {
      return yield* Effect.die(databases);
    }
    assert.strictEqual(databases.reason, "path does not exist");
  }),
);

it.effect("fails when a parent path segment is present rather than inventing empty ownership", () =>
  Effect.gen(function* program() {
    const store = InMemoryService({});
    const failure = yield* recordedWorkerNames(store, `${prefix}/../other`).pipe(Effect.flip);
    if (failure._tag !== "InvalidStatePath") {
      return yield* Effect.die(failure);
    }
    assert.strictEqual(failure.reason, "parent path segments are not allowed");
  }),
);
