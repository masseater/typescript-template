import { assert, it } from "@effect/vitest";
import { notificationMailSubjects } from "@repo/auth";
import { ROLE } from "@repo/config";
import { NOTIFICATION_KIND, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { fixtureOrigin } from "@repo/runtime/testing";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { followMember, listFollowers, listFollowing, unfollowMember } from "./member-social.ts";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
  unreadNotificationCount,
  updateNotificationPreferences,
} from "./notifications.ts";
import { OpsMail } from "./ops-mail.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { follow, user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");

const testLayer = Layer.merge(
  TestDatabase,
  Layer.succeed(OpsMail, {
    APP_ORIGIN: fixtureOrigin,
    EMAIL: env.EMAIL,
    EMAIL_FROM: "sender@example.test",
    OPS_EMAIL: "ops@example.test",
  }),
);

const addUser = (added: {
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly userId: string;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: added.email ?? `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.userId,
      role: ROLE.member,
      updatedAt: recordedAt,
    });
  });

function drainMailbox(): Effect.Effect<
  ReadonlyArray<{
    readonly subject: string;
    readonly text: string;
    readonly to: string | readonly string[];
  }>
> {
  return Effect.promise(async () => env.EMAIL.taken());
}

it.effect("follows a member and notifies the followee", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "followed" });
    yield* followMember("viewer", "followed");
    const [relation] = yield* query((database) =>
      database
        .select({ followeeId: follow.followeeId })
        .from(follow)
        .where(and(eq(follow.followerId, "viewer"), eq(follow.followeeId, "followed"))),
    );
    assert.isDefined(relation);
    const items = yield* listNotifications("followed");
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]?.kind, NOTIFICATION_KIND.follow);
    assert.strictEqual(items[0]?.read, false);
    assert.strictEqual(yield* unreadNotificationCount("followed"), 1);
  }).pipe(Effect.provide(testLayer)),
);

it.effect("does not follow unverified members", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ emailVerified: false, userId: "hidden" });
    const failed = yield* followMember("viewer", "hidden").pipe(Effect.flip);
    assert.strictEqual(failed._tag, "UserNotFound");
  }).pipe(Effect.provide(testLayer)),
);

it.effect("unfollow removes the relation", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "followed" });
    yield* followMember("viewer", "followed");
    yield* unfollowMember("viewer", "followed");
    assert.deepStrictEqual(yield* listFollowing("viewer", "viewer"), []);
  }).pipe(Effect.provide(testLayer)),
);

it.effect("lists followers and following with visibility rules", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "owner" });
    yield* addUser({ userId: "follower" });
    yield* addUser({ emailVerified: false, userId: "hidden" });
    yield* followMember("follower", "owner");
    yield* followMember("hidden", "owner");
    yield* followMember("owner", "follower");
    assert.deepStrictEqual(
      (yield* listFollowers("owner", "owner")).map((member) => member.id),
      ["follower"],
    );
    assert.deepStrictEqual(
      (yield* listFollowing("owner", "owner")).map((member) => member.id),
      ["follower"],
    );
  }).pipe(Effect.provide(testLayer)),
);

it.effect("marks one notification and all notifications as read", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "recipient" });
    const first = yield* notify({
      actorName: "actor-a",
      kind: NOTIFICATION_KIND.conversationMessage,
      recipientId: "recipient",
      subjectId: "conversation-a",
    });
    yield* notify({
      kind: NOTIFICATION_KIND.inquiryReply,
      recipientId: "recipient",
      subjectId: "inquiry-a",
    });
    yield* markNotificationRead("recipient", first);
    assert.strictEqual(yield* unreadNotificationCount("recipient"), 1);
    yield* markAllNotificationsRead("recipient");
    assert.strictEqual(yield* unreadNotificationCount("recipient"), 0);
    assert.isTrue((yield* listNotifications("recipient")).every((item) => item.read));
  }).pipe(Effect.provide(testLayer)),
);

it.effect("sends no mail with default preferences", () =>
  Effect.gen(function* program() {
    yield* addUser({ email: "quiet@example.com", userId: "quiet" });
    yield* drainMailbox();
    yield* notify({
      actorName: "sender",
      kind: NOTIFICATION_KIND.conversationMessage,
      recipientId: "quiet",
      subjectId: "conversation-b",
    });
    assert.deepStrictEqual(yield* drainMailbox(), []);
  }).pipe(Effect.provide(testLayer)),
);

it.effect("sends mail without message content when enabled", () =>
  Effect.gen(function* program() {
    yield* addUser({ email: "alert@example.com", userId: "alert" });
    yield* updateNotificationPreferences("alert", { boardMail: false, messageMail: true });
    yield* drainMailbox();
    yield* notify({
      actorName: "sender",
      kind: NOTIFICATION_KIND.conversationMessage,
      recipientId: "alert",
      subjectId: "conversation-c",
    });
    const [delivered] = yield* drainMailbox();
    assert.isDefined(delivered);
    assert.strictEqual(
      Array.isArray(delivered.to) ? delivered.to[0] : delivered.to,
      "alert@example.com",
    );
    assert.strictEqual(delivered.subject, notificationMailSubjects.conversationMessage);
    assert.notInclude(delivered.text, "secret body");
    assert.include(delivered.text, "/messages/conversation-c");
  }).pipe(Effect.provide(testLayer)),
);

it.effect("persists notification preferences", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    assert.deepStrictEqual(yield* getNotificationPreferences("member"), {
      boardMail: false,
      messageMail: false,
    });
    yield* updateNotificationPreferences("member", { boardMail: true, messageMail: false });
    assert.deepStrictEqual(yield* getNotificationPreferences("member"), {
      boardMail: true,
      messageMail: false,
    });
  }).pipe(Effect.provide(testLayer)),
);
