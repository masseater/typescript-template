import { assert, it } from "@effect/vitest";
import { type MailSettings } from "@repo/auth";
import { PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { fixtureOrigin } from "@repo/runtime/testing";
import { env } from "cloudflare:workers";
import { DateTime, Effect, Layer } from "effect";

import { advanceOnboarding, followMember, homeFeed, stepOf } from "./member-social.ts";
import { OpsMail } from "./ops-mail.ts";

import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { follow, user } = schema;
const recordedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

const testLayer = Layer.merge(
  TestDatabase,
  Layer.succeed(OpsMail, {
    APP_ORIGIN: fixtureOrigin,
    EMAIL: env.EMAIL as unknown as NonNullable<MailSettings["EMAIL"]>,
    EMAIL_FROM: "sender@example.test",
    OPS_EMAIL: "ops@example.test",
  }),
);

const addUser = (added: {
  readonly userId: string;
  readonly emailVerified?: boolean;
  readonly profile?: string;
  readonly visibility?: ProfileVisibility;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query((database) =>
    database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.userId,
      profile: added.profile ?? "",
      role: ROLE.member,
      updatedAt: recordedAt,
      visibility: added.visibility ?? PROFILE_VISIBILITY.allMembers,
    }),
  );

it.effect("omits members the viewer does not follow", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ profile: "近況です。", userId: "followed" });
    yield* addUser({ userId: "stranger" });
    yield* followMember("viewer", "followed");
    const feed = yield* homeFeed("viewer");
    assert.deepStrictEqual(feed, [
      {
        actorId: "followed",
        actorName: "followed",
        kind: "profile",
        profile: "近況です。",
        updatedAt: recordedAt.getTime(),
      },
    ]);
  }).pipe(Effect.provide(testLayer)),
);

it.effect("omits unverified followees from the feed", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ emailVerified: false, userId: "unverified" });
    yield* query((database) =>
      database.insert(follow).values({
        createdAt: recordedAt,
        followeeId: "unverified",
        followerId: "viewer",
      }),
    );
    assert.deepStrictEqual(yield* homeFeed("viewer"), []);
  }).pipe(Effect.provide(testLayer)),
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
  }).pipe(Effect.provide(testLayer)),
);

it.effect("treats missing onboarding rows as the agreement step", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "newcomer" });
    assert.strictEqual(yield* stepOf("newcomer"), "agreement");
  }).pipe(Effect.provide(testLayer)),
);

it.effect("advances and reads the saved onboarding step", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "newcomer" });
    yield* advanceOnboarding("newcomer", "choose");
    assert.strictEqual(yield* stepOf("newcomer"), "choose");
  }).pipe(Effect.provide(testLayer)),
);
