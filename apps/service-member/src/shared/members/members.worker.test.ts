import { assert, describe, it } from "@effect/vitest";
import { ACCOUNT_STATE, ROLE } from "@repo/config";
import { query, schema } from "@repo/db";
import { followMember, homeFeed } from "@repo/db/member-social";
import { TestDatabase } from "@repo/db/testing";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { getMember, listMembers } from "./members.ts";

import type { AccountState, Role } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;

const addUser = (added: {
  readonly id: string;
  readonly role?: Role;
  readonly accountState?: AccountState;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      accountState: added.accountState ?? ACCOUNT_STATE.active,
      createdAt: new Date(),
      email: `${added.id}@example.com`,
      emailVerified: true,
      id: added.id,
      name: added.id,
      role: added.role ?? ROLE.member,
      updatedAt: new Date(),
    });
  });

const community = Effect.gen(function* community() {
  yield* addUser({ id: "viewer" });
  yield* addUser({ id: "active" });
  yield* addUser({ accountState: ACCOUNT_STATE.suspended, id: "suspended" });
  yield* addUser({ id: "operator", role: ROLE.administrator });
  yield* addUser({ id: "editor", role: ROLE.staff });
  yield* followMember("viewer", "active");
  yield* followMember("viewer", "suspended");
  yield* followMember("viewer", "operator");
});

describe("member visibility", () => {
  it.effect("lists only active members", () =>
    Effect.gen(function* program() {
      yield* community;
      const listed = yield* listMembers({ limit: 10, offset: 0 });
      assert.deepStrictEqual(listed.members.map((member) => member.id).toSorted(), [
        "active",
        "viewer",
      ]);
      assert.strictEqual(listed.total, 2);
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect.each(["suspended", "operator", "editor"])(
    "hides the profile of %s from other members",
    (hiddenId) =>
      Effect.gen(function* program() {
        yield* community;
        const failure = yield* getMember("viewer", hiddenId).pipe(Effect.flip);
        assert.strictEqual(failure._tag, "UserNotFound");
      }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("drops suspended and privileged followees from the home feed", () =>
    Effect.gen(function* program() {
      yield* community;
      const feed = yield* homeFeed("viewer");
      assert.deepStrictEqual(
        feed.map((item) => item.actorId),
        ["active"],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("shows a member again once unsuspended", () =>
    Effect.gen(function* program() {
      yield* community;
      yield* query((database) =>
        database
          .update(user)
          .set({ accountState: ACCOUNT_STATE.active })
          .where(eq(user.id, "suspended")),
      );
      const member = yield* getMember("viewer", "suspended");
      assert.strictEqual(member.id, "suspended");
    }).pipe(Effect.provide(TestDatabase)),
  );
});
