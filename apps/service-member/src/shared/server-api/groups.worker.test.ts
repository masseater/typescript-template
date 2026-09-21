import { assert, describe, it } from "@effect/vitest";
import {
  CONVERSATION_KIND,
  GROUP_JOIN_POLICY,
  REPORT_REASON,
  REPORT_SUBJECT,
  ROLE,
} from "@repo/config";
import { blockMember, fileReport, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { createGroup, findGroup, joinGroup, listOpenGroups } from "./groups.ts";
import { findDirectConversation, listDirectConversations, sendDirectMessage } from "./messaging.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");
const firstPage = { limit: 20, offset: 0 };
const wholePage = { limit: 50, offset: 0 };
const secret = "招待グループの本文";

const addUser = (
  userId: string,
  role = ROLE.member,
): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${userId}@example.com`,
      emailVerified: true,
      id: userId,
      name: userId,
      role,
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

describe("group conversations", () => {
  it.effect("hides invite-only groups from non-members on every read path", () =>
    Effect.gen(function* program() {
      yield* addUser("owner");
      yield* addUser("joiner");
      yield* addUser("guest");
      yield* addUser("operator", ROLE.administrator);
      const created = yield* createGroup("owner", {
        joinPolicy: GROUP_JOIN_POLICY.invite,
        name: "招待グループ",
      });
      assert.strictEqual(yield* failureTag(findGroup("guest", created.groupId)), "GroupNotFound");
      assert.strictEqual(
        yield* failureTag(findDirectConversation("guest", created.conversationId, wholePage)),
        "MessagingConversationNotFound",
      );
      assert.strictEqual(
        yield* failureTag(findDirectConversation("operator", created.conversationId, wholePage)),
        "MessagingMemberRequired",
      );
      assert.strictEqual((yield* listDirectConversations("guest", firstPage)).total, 0);
      yield* joinGroup("joiner", created.groupId, created.inviteToken);
      const messageId = yield* sendDirectMessage("joiner", created.conversationId, secret);
      assert.strictEqual(
        yield* failureTag(
          fileReport(
            "guest",
            { id: messageId, kind: REPORT_SUBJECT.groupMessage },
            REPORT_REASON.spam,
          ),
        ),
        "TrustSubjectNotFound",
      );
      const thread = yield* findDirectConversation("owner", created.conversationId, wholePage);
      assert.strictEqual(thread.conversation.kind, CONVERSATION_KIND.group);
      assert.deepStrictEqual(
        thread.messages.map((message) => message.body),
        [secret],
      );
      const listed = yield* listDirectConversations("owner", firstPage);
      assert.strictEqual(listed.conversations[0]?.kind, CONVERSATION_KIND.group);
      assert.strictEqual(listed.conversations[0]?.peer.name, "招待グループ");
      const openGroups = yield* listOpenGroups("guest");
      assert.deepStrictEqual(
        openGroups.filter((group) => group.id === created.groupId),
        [],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("shows open group info without membership and hides blocked senders", () =>
    Effect.gen(function* program() {
      yield* addUser("owner");
      yield* addUser("guest");
      const created = yield* createGroup("owner", {
        joinPolicy: GROUP_JOIN_POLICY.open,
        name: "公開グループ",
      });
      const viewed = yield* findGroup("guest", created.groupId);
      assert.strictEqual(viewed.isMember, false);
      assert.strictEqual(viewed.inviteToken, null);
      assert.strictEqual(
        yield* failureTag(findDirectConversation("guest", created.conversationId, wholePage)),
        "MessagingConversationNotFound",
      );
      assert.deepStrictEqual(yield* listOpenGroups("guest"), [
        { id: created.groupId, name: "公開グループ" },
      ]);
      yield* joinGroup("guest", created.groupId);
      const hiddenBody = "ブロックされる本文";
      yield* sendDirectMessage("guest", created.conversationId, hiddenBody);
      yield* blockMember("owner", "guest");
      const thread = yield* findDirectConversation("owner", created.conversationId, wholePage);
      assert.strictEqual(JSON.stringify(thread).includes(hiddenBody), false);
      const listed = yield* listDirectConversations("owner", firstPage);
      assert.strictEqual(listed.conversations[0]?.lastMessagePreview.includes(hiddenBody), false);
    }).pipe(Effect.provide(TestDatabase)),
  );
});
