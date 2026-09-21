import { assert, describe, it } from "@effect/vitest";
import { ROLE, type Role } from "@repo/config";
import { blockMember, GROUP_JOIN_POLICY, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { createGroup, findGroup, joinGroup, leaveGroup, renameGroup } from "./groups.ts";

const maximumGroupMembers = 100;
const maximumGroupsOwned = 20;
const maximumGroupsJoined = 50;
import { findConversation, listInbox, sendConversationMessage } from "./messaging.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");
const wholePage = { limit: 50, offset: 0 };

const addUser = (added: {
  readonly userId: string;
  readonly role?: Role;
  readonly emailVerified?: boolean;
  readonly name?: string;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.name ?? added.userId,
      role: added.role ?? ROLE.member,
      updatedAt: recordedAt,
    });
  });

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

const openGroup = Effect.fn("openGroup")(function* openGroup(
  ownerId: string,
  name: string,
  joinPolicy:
    | typeof GROUP_JOIN_POLICY.invite
    | typeof GROUP_JOIN_POLICY.open = GROUP_JOIN_POLICY.invite,
) {
  yield* TestClock.adjust("1 minute");
  return yield* createGroup(ownerId, { joinPolicy, name });
});

describe("who may use groups", () => {
  it.effect.each([
    { emailVerified: false, role: ROLE.member, userId: "unverified" },
    { emailVerified: true, role: ROLE.administrator, userId: "operator" },
  ])("refuses $userId for reading and writing", ({ emailVerified, role, userId }) =>
    Effect.gen(function* program() {
      yield* addUser({ emailVerified, role, userId });
      yield* addUser({ userId: "owner" });
      const created = yield* openGroup("owner", "テスト");
      assert.strictEqual(
        yield* failureTag(findGroup(userId, created.groupId)),
        "MessagingMemberRequired",
      );
      assert.strictEqual(
        yield* failureTag(
          createGroup(userId, { joinPolicy: GROUP_JOIN_POLICY.open, name: "新規" }),
        ),
        "MessagingMemberRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("creating groups", () => {
  it.effect("creates an invite-only group with the owner as a member", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      const created = yield* openGroup("owner", "勉強会");
      const group = yield* findGroup("owner", created.groupId);
      assert.strictEqual(group.name, "勉強会");
      assert.strictEqual(group.isOwner, true);
      assert.strictEqual(group.isMember, true);
      assert.strictEqual(group.joinPolicy, GROUP_JOIN_POLICY.invite);
      assert.strictEqual(group.memberCount, 1);
      assert.strictEqual(group.members[0]?.id, "owner");
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("creates an open group", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      const created = yield* openGroup("owner", "公開", GROUP_JOIN_POLICY.open);
      const group = yield* findGroup("owner", created.groupId);
      assert.strictEqual(group.joinPolicy, GROUP_JOIN_POLICY.open);
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("invite-only visibility", () => {
  it.effect("hides an invite-only group from non-members without a token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "stranger" });
      const created = yield* openGroup("owner", "秘密");
      assert.strictEqual(
        yield* failureTag(findGroup("stranger", created.groupId)),
        "GroupNotFound",
      );
      assert.strictEqual(
        yield* failureTag(findConversation("stranger", created.conversationId, wholePage)),
        "MessagingConversationNotFound",
      );
      assert.strictEqual(
        yield* failureTag(sendConversationMessage("stranger", created.conversationId, "侵入")),
        "MessagingConversationNotFound",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("lets a non-member preview an invite-only group with a valid token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "招待制");
      const preview = yield* findGroup("guest", created.groupId, created.inviteToken);
      assert.strictEqual(preview.isMember, false);
      assert.strictEqual(preview.name, "招待制");
      assert.strictEqual(preview.memberCount, 1);
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("still hides messages from non-members who only have a preview token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "招待制");
      yield* sendConversationMessage("owner", created.conversationId, "内部の話");
      assert.strictEqual(
        yield* failureTag(findConversation("guest", created.conversationId, wholePage)),
        "MessagingConversationNotFound",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("joining and leaving", () => {
  it.effect("joins an invite-only group with a valid token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "勉強会");
      const conversationId = yield* joinGroup("guest", created.groupId, created.inviteToken);
      assert.strictEqual(conversationId, created.conversationId);
      const group = yield* findGroup("guest", created.groupId);
      assert.strictEqual(group.isMember, true);
      assert.strictEqual(group.memberCount, 2);
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("joins an open group without a token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "公開", GROUP_JOIN_POLICY.open);
      yield* joinGroup("guest", created.groupId);
      const group = yield* findGroup("guest", created.groupId);
      assert.strictEqual(group.isMember, true);
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses joining an invite-only group without a token", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "招待制");
      assert.strictEqual(yield* failureTag(joinGroup("guest", created.groupId)), "GroupNotFound");
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("lets a non-owner leave a group", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "勉強会", GROUP_JOIN_POLICY.open);
      yield* joinGroup("guest", created.groupId);
      yield* leaveGroup("guest", created.groupId);
      const guestView = yield* findGroup("guest", created.groupId);
      assert.strictEqual(guestView.isMember, false);
      const ownerView = yield* findGroup("owner", created.groupId);
      assert.strictEqual(ownerView.memberCount, 1);
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses the owner from leaving", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      const created = yield* openGroup("owner", "勉強会");
      assert.strictEqual(yield* failureTag(leaveGroup("owner", created.groupId)), "GroupNotFound");
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("ownership and posting", () => {
  it.effect("lets the owner rename the group", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "旧名", GROUP_JOIN_POLICY.open);
      yield* joinGroup("guest", created.groupId);
      yield* renameGroup("owner", created.groupId, "新名");
      assert.strictEqual((yield* findGroup("guest", created.groupId)).name, "新名");
      assert.strictEqual(
        yield* failureTag(renameGroup("guest", created.groupId, "勝手に変える")),
        "GroupNotFound",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("lets members post and read messages after joining", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "勉強会", GROUP_JOIN_POLICY.open);
      yield* joinGroup("guest", created.groupId);
      yield* TestClock.adjust("1 minute");
      yield* sendConversationMessage("owner", created.conversationId, "はじめまして");
      yield* TestClock.adjust("1 minute");
      yield* sendConversationMessage("guest", created.conversationId, "よろしく");
      const thread = yield* findConversation("guest", created.conversationId, wholePage);
      assert.deepStrictEqual(
        thread.messages.map((message) => [message.mine, message.body]),
        [
          [false, "はじめまして"],
          [true, "よろしく"],
        ],
      );
      const listed = yield* listInbox("guest", wholePage);
      assert.strictEqual(listed.total, 1);
      const listedHead = listed.conversations[0];
      if (listedHead === undefined || !("group" in listedHead)) {
        throw new Error("expected a group conversation");
      }
      assert.strictEqual(listedHead.group.name, "勉強会");
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("hides messages from a blocked sender in an open group", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      yield* addUser({ userId: "guest" });
      const created = yield* openGroup("owner", "公開グループ", GROUP_JOIN_POLICY.open);
      yield* joinGroup("guest", created.groupId);
      const hiddenBody = "ブロックされる本文";
      yield* sendConversationMessage("guest", created.conversationId, hiddenBody);
      yield* blockMember("owner", "guest");
      const thread = yield* findConversation("owner", created.conversationId, wholePage);
      assert.strictEqual(JSON.stringify(thread).includes(hiddenBody), false);
      const listed = yield* listInbox("owner", { limit: 20, offset: 0 });
      assert.strictEqual(listed.conversations[0]?.lastMessagePreview.includes(hiddenBody), false);
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("limits", () => {
  it.effect("refuses creating more than the owned-group limit", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      for (let index = 0; index < maximumGroupsOwned; index += 1) {
        yield* openGroup("owner", `グループ ${index}`);
      }
      assert.strictEqual(
        yield* failureTag(
          createGroup("owner", { joinPolicy: GROUP_JOIN_POLICY.open, name: "上限超え" }),
        ),
        "GroupLimitReached",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses joining more than the membership limit", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "guest" });
      for (let index = 0; index < maximumGroupsJoined; index += 1) {
        yield* addUser({ userId: `owner-${index}` });
        const created = yield* openGroup(
          `owner-${index}`,
          `グループ ${index}`,
          GROUP_JOIN_POLICY.open,
        );
        yield* joinGroup("guest", created.groupId);
      }
      yield* addUser({ userId: "one-more-owner" });
      const overflow = yield* openGroup("one-more-owner", "溢れる", GROUP_JOIN_POLICY.open);
      assert.strictEqual(
        yield* failureTag(joinGroup("guest", overflow.groupId)),
        "GroupLimitReached",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses joining a full group", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "owner" });
      const created = yield* openGroup("owner", "満員", GROUP_JOIN_POLICY.open);
      for (let index = 0; index < maximumGroupMembers - 1; index += 1) {
        yield* addUser({ userId: `member-${index}` });
        yield* joinGroup(`member-${index}`, created.groupId);
      }
      yield* addUser({ userId: "late" });
      assert.strictEqual(
        yield* failureTag(joinGroup("late", created.groupId)),
        "GroupLimitReached",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});
