import { and, desc, eq, query, schema } from "@repo/db";
import { Effect } from "effect";

import { maySendGroupMessage } from "#shared/messaging/index.ts";
import {
  groupConversationKind,
  insertMessage,
  memberships,
  requireConversationKind,
  threadPage,
  unreadCountFor,
  visibleInThread,
} from "./conversation-thread.ts";
import { canReadGroupConversation } from "./groups.ts";
import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { requireMessagingMember } from "./verified-member.ts";

import type { OffsetPage } from "./verified-member.ts";

const { conversation, directMessage, memberGroup } = schema;

interface ConversationSummary {
  readonly group: { readonly id: string; readonly name: string };
  readonly id: string;
  readonly kind: typeof groupConversationKind;
  readonly lastMessageAt: number;
  readonly lastMessagePreview: string;
  readonly unreadCount: number;
}

interface ConversationView {
  readonly group: { readonly id: string; readonly name: string };
  readonly id: string;
  readonly kind: typeof groupConversationKind;
  readonly total: number;
}

const requireGroupParticipant = Effect.fn("requireGroupParticipant")(
  function* requireGroupParticipant(viewerId: string, conversationId: string) {
    if (!(yield* canReadGroupConversation(viewerId, conversationId))) {
      return yield* new MessagingConversationNotFound();
    }
  },
);

const groupTargetOf = Effect.fn("groupTargetOf")(function* groupTargetOf(conversationId: string) {
  const [group] = yield* query((database) =>
    database
      .select({ id: memberGroup.id, name: memberGroup.name })
      .from(memberGroup)
      .where(eq(memberGroup.conversationId, conversationId))
      .limit(1),
  );
  if (group === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  return { group: { id: group.id, name: group.name }, kind: groupConversationKind };
});

const listGroupConversations = Effect.fn("listGroupConversations")(function* listGroupConversations(
  viewerId: string,
  page: OffsetPage,
) {
  yield* requireMessagingMember(viewerId);
  const summaries: ConversationSummary[] = [];
  for (const membership of yield* memberships(viewerId)) {
    const [thread] = yield* query((database) =>
      database
        .select({
          id: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
        })
        .from(conversation)
        .where(
          and(
            eq(conversation.id, membership.conversationId),
            eq(conversation.kind, groupConversationKind),
          ),
        )
        .limit(1),
    );
    if (thread === undefined) {
      continue;
    }
    const target = yield* groupTargetOf(thread.id);
    const [lastMessage] = yield* query((database) =>
      database
        .select({ body: directMessage.body })
        .from(directMessage)
        .where(visibleInThread(viewerId, membership.conversationId, true))
        .orderBy(desc(directMessage.createdAt), desc(directMessage.id))
        .limit(1),
    );
    const unreadCount = yield* unreadCountFor(viewerId, membership.conversationId, true);
    summaries.push({
      group: target.group,
      id: thread.id,
      kind: groupConversationKind,
      lastMessageAt: thread.lastMessageAt.getTime(),
      lastMessagePreview: lastMessage?.body ?? "",
      unreadCount,
    });
  }
  summaries.sort((left, right) => right.lastMessageAt - left.lastMessageAt);
  return {
    conversations: summaries.slice(page.offset, page.offset + page.limit),
    total: summaries.length,
  };
});

const findGroupConversation = Effect.fn("findGroupConversation")(function* findGroupConversation(
  viewerId: string,
  conversationId: string,
  page: OffsetPage,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireGroupParticipant(viewerId, conversationId);
  const target = yield* groupTargetOf(conversationId);
  yield* requireConversationKind(conversationId, groupConversationKind);
  const thread = yield* threadPage(viewerId, conversationId, page, true);
  const conversationView: ConversationView = {
    group: target.group,
    id: conversationId,
    kind: groupConversationKind,
    total: thread.total,
  };
  return { conversation: conversationView, ...thread };
});

const sendGroupMessage = Effect.fn("sendGroupMessage")(function* sendGroupMessage(
  senderId: string,
  conversationId: string,
  body: string,
) {
  const sender = yield* requireMessagingMember(senderId);
  yield* requireGroupParticipant(senderId, conversationId);
  if (!(yield* maySendGroupMessage(senderId, conversationId))) {
    return yield* new MessagingConversationNotFound();
  }
  yield* requireConversationKind(conversationId, groupConversationKind);
  return yield* insertMessage(sender.id, sender.name, conversationId, body);
});

export { findGroupConversation, listGroupConversations, requireGroupParticipant, sendGroupMessage };
