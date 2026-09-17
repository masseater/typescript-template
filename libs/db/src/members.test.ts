import { addUser, failureTag } from "./records-fixture.ts";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestDatabase } from "./testing.ts";
import { eq } from "drizzle-orm";
import { getMember } from "./members.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";

function describeMember(
  id: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  values: { readonly createdAt: Date; readonly name: string; readonly profile: string },
): ReturnType<typeof addUser> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return query(async (database): Promise<void> => {
    await database.update(user).set(values).where(eq(user.id, id));
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
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("shows an unverified member to nobody but themselves", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("pending", "user", false);
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
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("answers a missing member the same way as one the viewer may not open", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    assert.strictEqual(yield* failureTag(getMember("viewer", "missing")), "UserNotFound");
  }).pipe(Effect.provide(TestDatabase)),
);
