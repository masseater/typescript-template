import { assert, it } from "@effect/vitest";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { getMember } from "./members.ts";

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

function addUser(id: string, emailVerified = true): Effect.Effect<void, DatabaseFailure, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${id}@example.com`,
      emailVerified,
      id,
      name: id,
      role: "member",
      updatedAt: new Date(),
    });
  });
}

function describeMember(
  id: string,
  values: {
    readonly createdAt: Date;
    readonly name: string;
    readonly profile: string;
    readonly socialLinks?: readonly string[];
  },
): Effect.Effect<void, DatabaseFailure, Database> {
  return query(async (database): Promise<void> => {
    await database
      .update(user)
      .set({
        createdAt: values.createdAt,
        name: values.name,
        profile: values.profile,
        socialLinks: values.socialLinks ?? [],
      })
      .where(eq(user.id, id));
  });
}

it.effect("shows another member only what the profile page shows to others", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("reader");
    yield* describeMember("reader", {
      createdAt: new Date("2026-08-31T23:59:59.999Z"),
      name: "山田 花子",
      profile: "はじめまして。",
    });
    assert.deepStrictEqual(yield* getMember("viewer", "reader"), {
      id: "reader",
      joined: "2026-08",
      name: "山田 花子",
      profile: "はじめまして。",
      socialLinks: [],
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("shows an unverified member to nobody but themselves", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("pending", false);
    yield* describeMember("pending", {
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      name: "pending",
      profile: "",
    });
    assert.strictEqual(yield* failureTag(getMember("viewer", "pending")), "UserNotFound");
    assert.deepStrictEqual(yield* getMember("pending", "pending"), {
      id: "pending",
      joined: "2026-09",
      name: "pending",
      profile: "",
      socialLinks: [],
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("answers a missing member the same way as one the viewer may not open", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    assert.strictEqual(yield* failureTag(getMember("viewer", "missing")), "UserNotFound");
  }).pipe(Effect.provide(TestDatabase)),
);
