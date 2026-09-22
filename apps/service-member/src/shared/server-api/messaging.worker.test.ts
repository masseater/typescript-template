import { assert, describe, it } from "@effect/vitest";
import {
  ADMIN_PERMISSION,
  ROLE,
  STAFF_PERMISSION,
  SUBSCRIPTION_STATUS,
  type AccountPermission,
  type Role,
} from "@repo/config";
import { eq, query, recordSubscription, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect, DateTime, Schema } from "effect";
import { TestClock } from "effect/testing";

import {
  findConversation,
  listInbox,
  openDirectConversation,
  sendDirectMessage,
} from "./messaging.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const withdrawnSenderLabel = "退会した会員";
const secretBody = "OUTSIDER_MUST_NOT_READ_THIS_MESSAGE";

const { user } = schema;
const recordedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));
const monthLater = DateTime.toDate(DateTime.makeUnsafe("2026-10-20T00:00:00.000Z"));
const firstPage = { limit: 20, offset: 0 };
const wholePage = { limit: 50, offset: 0 };
const greeting = secretBody;
const reply = "こちらこそ。";

const permissionFor = (role: Role): AccountPermission | undefined => {
  if (role === ROLE.administrator) {
    return ADMIN_PERMISSION.viewer;
  }
  if (role === ROLE.staff) {
    return STAFF_PERMISSION.viewer;
  }
  return undefined;
};

const addUser = (added: {
  readonly userId: string;
  readonly role?: Role;
  readonly emailVerified?: boolean;
  readonly name?: string;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query((database) => {
    const role = added.role ?? ROLE.member;
    const permission = permissionFor(role);
    return database
      .insert(user)
      .values({
        createdAt: recordedAt,
        email: `${added.userId}@example.com`,
        emailVerified: added.emailVerified ?? true,
        id: added.userId,
        name: added.name ?? added.userId,
        role,
        updatedAt: recordedAt,
        ...(permission === undefined ? {} : { permission }),
      })
      .then(() => undefined);
  });

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

const makePaid = Effect.fn("makePaid")(function* makePaid(memberId: string) {
  yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")));
  yield* recordSubscription(
    {
      createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")),
      id: `evt_${memberId}`,
      type: "updated",
    },
    {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: monthLater,
      memberId,
      status: SUBSCRIPTION_STATUS.active,
      stripeCustomerId: `cus_${memberId}`,
      stripeSubscriptionId: `sub_${memberId}`,
    },
  );
});

const startConversation = Effect.fn("startConversation")(function* startConversation(
  senderId: string,
  recipientId: string,
  body: string,
) {
  yield* TestClock.adjust("1 minute");
  return yield* openDirectConversation(senderId, recipientId, body);
});

describe("who may use direct messages", () => {
  it.effect.each([
    { emailVerified: false, role: ROLE.member, userId: "unverified" },
    { emailVerified: true, role: ROLE.administrator, userId: "operator" },
    { emailVerified: true, role: ROLE.staff, userId: "staff" },
  ])("refuses $userId for reading and writing", ({ emailVerified, role, userId }) =>
    Effect.gen(function* program() {
      yield* addUser({ emailVerified, role, userId });
      assert.strictEqual(
        yield* failureTag(listInbox(userId, firstPage)),
        "MessagingMemberRequired",
      );
      assert.strictEqual(
        yield* failureTag(openDirectConversation(userId, "peer", greeting)),
        "MessagingMemberRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("paid and free members", () => {
  it.effect("lets a paid member open a conversation and the recipient read it", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "paid" });
      yield* addUser({ userId: "free" });
      yield* makePaid("paid");
      const opened = yield* startConversation("paid", "free", greeting);
      const forSender = yield* findConversation("paid", opened.conversationId, wholePage);
      const forRecipient = yield* findConversation("free", opened.conversationId, wholePage);
      assert.deepStrictEqual(
        forSender.messages.map((message) => [message.mine, message.body, message.sender.name]),
        [[true, greeting, "paid"]],
      );
      assert.deepStrictEqual(
        forRecipient.messages.map((message) => [message.mine, message.body, message.sender.name]),
        [[false, greeting, "paid"]],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses a free member from opening a new conversation", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "free" });
      yield* addUser({ userId: "target" });
      assert.strictEqual(
        yield* failureTag(openDirectConversation("free", "target", greeting)),
        "PaidPlanRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("lets a free member reply in an existing conversation", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "paid" });
      yield* addUser({ userId: "free" });
      yield* makePaid("paid");
      const opened = yield* startConversation("paid", "free", greeting);
      yield* TestClock.adjust("1 minute");
      yield* sendDirectMessage("free", opened.conversationId, reply);
      const thread = yield* findConversation("paid", opened.conversationId, wholePage);
      assert.deepStrictEqual(
        thread.messages.map((message) => [message.mine, message.body]),
        [
          [true, greeting],
          [false, reply],
        ],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("withdrawn senders", () => {
  it.effect("keeps the message and labels the withdrawn sender", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "paid" });
      yield* addUser({ userId: "free" });
      yield* makePaid("paid");
      const opened = yield* startConversation("paid", "free", greeting);
      yield* query((database) =>
        database
          .delete(user)
          .where(eq(user.id, "paid"))
          .then(() => undefined),
      );
      const thread = yield* findConversation("free", opened.conversationId, wholePage);
      assert.deepStrictEqual(
        thread.messages.map((message) => message.sender),
        [{ id: null, name: withdrawnSenderLabel }],
      );
      if (!("peer" in thread.conversation)) {
        throw new Error("expected a direct conversation");
      }
      assert.strictEqual(thread.conversation.peer.name, withdrawnSenderLabel);
      assert.strictEqual(thread.conversation.peer.withdrawn, true);
      assert.strictEqual(thread.conversation.peer.id, null);
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("conversation access", () => {
  it.effect("refuses a member who is not a participant", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "paid" });
      yield* addUser({ userId: "free" });
      yield* addUser({ userId: "stranger" });
      yield* makePaid("paid");
      const opened = yield* startConversation("paid", "free", greeting);
      const listed = yield* listInbox("stranger", firstPage);
      assert.deepStrictEqual(listed.conversations, []);
      assert.strictEqual(
        yield* failureTag(findConversation("stranger", opened.conversationId, wholePage)),
        "MessagingConversationNotFound",
      );
      assert.strictEqual(
        yield* failureTag(sendDirectMessage("stranger", opened.conversationId, reply)),
        "MessagingConversationNotFound",
      );
      const listedJson = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(listed);
      assert.isFalse(listedJson.includes(secretBody));
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses an administrator and a staff user who are not participants", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "paid" });
      yield* addUser({ userId: "free" });
      yield* addUser({ role: ROLE.administrator, userId: "operator" });
      yield* addUser({ role: ROLE.staff, userId: "staff" });
      yield* makePaid("paid");
      const opened = yield* startConversation("paid", "free", greeting);
      assert.strictEqual(
        yield* failureTag(findConversation("operator", opened.conversationId, wholePage)),
        "MessagingMemberRequired",
      );
      assert.strictEqual(
        yield* failureTag(findConversation("staff", opened.conversationId, wholePage)),
        "MessagingMemberRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});
