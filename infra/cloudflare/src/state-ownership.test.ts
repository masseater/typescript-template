import { assert, it } from "@effect/vitest";
import { InMemoryService } from "alchemy/State";
import { Effect } from "effect";

import { recordedDatabaseIds, recordedWorkerNames } from "./state-ownership.ts";
import { verificationSettings } from "./verification-fixture.ts";

const prefix = verificationSettings.prefix;

it.effect("treats a path the store has never held as holding no records", () =>
  Effect.gen(function* program() {
    const store = InMemoryService({});
    assert.deepStrictEqual(yield* recordedWorkerNames(store, prefix), []);
    assert.deepStrictEqual(yield* recordedDatabaseIds(store, prefix), []);
  }),
);

it.effect("fails when a parent path segment is present rather than inventing empty ownership", () =>
  Effect.gen(function* program() {
    const store = InMemoryService({});
    const failure = yield* recordedWorkerNames(store, `${prefix}/../other`).pipe(Effect.flip);
    assert.strictEqual(failure._tag, "InvalidStatePath");
    assert.strictEqual(failure.reason, "parent path segments are not allowed");
  }),
);
