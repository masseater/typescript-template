import { assert, it } from "@effect/vitest";
import { createMemberInquiry, getMemberInquiry, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

const { user } = schema;

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

function addUser(id: string): Effect.Effect<void, unknown, never> {
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

it.effect("keeps member inquiries isolated through the support data layer", () =>
  Effect.gen(function* program() {
    yield* addUser("owner");
    yield* addUser("other");
    const created = yield* createMemberInquiry("owner", { body: "本文", subject: "件名" });
    const owned = yield* getMemberInquiry("owner", created.id);
    assert.strictEqual(owned.id, created.id);
    assert.strictEqual(yield* failureTag(getMemberInquiry("other", created.id)), "InquiryNotFound");
  }).pipe(Effect.provide(TestDatabase)),
);
