import { assert, it } from "@effect/vitest";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { getProfile, updateProfile } from "./members.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

function addUser(id: string): Effect.Effect<void, DatabaseFailure, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${id}@example.com`,
      emailVerified: true,
      id,
      name: id,
      role: "member",
      updatedAt: new Date(),
    });
  });
}

it.effect("persists Unicode profiles", () =>
  Effect.gen(function* program() {
    yield* addUser("reader");
    yield* updateProfile("reader", {
      name: "日本語 العربية 🐈",
      profile: "私は開発者です。",
      socialLinks: ["https://github.com/reader"],
    });
    const profile = yield* getProfile("reader");
    assert.strictEqual(profile?.name, "日本語 العربية 🐈");
    assert.strictEqual(profile?.profile, "私は開発者です。");
    assert.deepStrictEqual(profile?.socialLinks, ["https://github.com/reader"]);
    assert.strictEqual(
      yield* failureTag(
        updateProfile("missing", { name: "missing", profile: "", socialLinks: [] }),
      ),
      "UserNotFound",
    );
  }).pipe(Effect.provide(TestDatabase)),
);
