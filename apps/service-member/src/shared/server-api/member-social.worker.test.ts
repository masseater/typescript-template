import { assert, it } from "@effect/vitest";
import { PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { advanceOnboarding, homeFeed, stepOf } from "./member-social.ts";

import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { follow, user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");

const followMember = (followerId: string, followeeId: string) =>
  query((database) =>
    database
      .insert(follow)
      .values({ createdAt: recordedAt, followeeId, followerId })
      .onConflictDoNothing(),
  );

const addUser = (added: {
  readonly userId: string;
  readonly emailVerified?: boolean;
  readonly visibility?: ProfileVisibility;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.userId,
      role: ROLE.member,
      updatedAt: recordedAt,
      visibility: added.visibility ?? PROFILE_VISIBILITY.allMembers,
    });
  });

it.effect("omits members the viewer does not follow", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "followed" });
    yield* addUser({ userId: "stranger" });
    yield* followMember("viewer", "followed");
    const feed = yield* homeFeed("viewer");
    assert.deepStrictEqual(
      feed.map((item) => item.actorId),
      ["followed"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("omits unverified followees from the feed", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ emailVerified: false, userId: "unverified" });
    yield* followMember("viewer", "unverified");
    assert.deepStrictEqual(yield* homeFeed("viewer"), []);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("the home feed drops followees who closed their profile", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
    yield* addUser({ userId: "open" });
    yield* followMember("viewer", "hidden");
    yield* followMember("viewer", "open");
    assert.deepStrictEqual(
      (yield* homeFeed("viewer")).map((item) => item.actorId),
      ["open"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("treats missing onboarding rows as the agreement step", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "newcomer" });
    assert.strictEqual(yield* stepOf("newcomer"), "agreement");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("advances and reads the saved onboarding step", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "newcomer" });
    yield* advanceOnboarding("newcomer", "choose");
    assert.strictEqual(yield* stepOf("newcomer"), "choose");
  }).pipe(Effect.provide(TestDatabase)),
);
