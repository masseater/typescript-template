import { ROLE } from "@repo/config";
import { CONVERSATION_KIND, query, schema } from "@repo/db";
import { and, count, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { maySendGroupMessage } from "#shared/messaging/index.ts";
import { canReadGroupConversation, groupIdForConversation } from "./groups.ts";
import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { conversation, conversationParticipant, directMessage, memberGroup, user } = schema;

const groupConversationKind = CONVERSATION_KIND.group;
const withdrawnSenderLabel = "退会した会員";

interface Page {
  readonly limit: number;
  readonly offset: number;
}

interface MessageSender {
  readonly id: string | null;
  readonly name: string;
}

interface MessageView {
  readonly body: string;
  readonly createdAt: number;
  readonly id: string;
  readonly mine: boolean;
  readonly sender: MessageSender;
}

interface GroupConversationTarget {
  readonly group: { readonly id: string; readonly name: string };
  readonly kind: typeof groupConversationKind;
}

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

const messagingMember = and(eq(user.role, ROLE.member), eq(user.emailVerified, true));
const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

function shownSender(row: {
  readonly senderId: string | null;
  readonly senderName: string;
}): MessageSender {
  if (row.senderId === null) {
    return { id: null, name: withdrawnSenderLabel };
  }
  return { id: row.senderId, name: row.senderName };
}

function shownMessage(
  viewerId: string,
  row: {
    readonly body: string;
    readonly createdAt: Readonly<Date>;
    readonly id: string;
    readonly senderId: string | null;
    readonly senderName: string;
  },
): MessageView {
  return {
    body: row.body,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    mine: row.senderId === viewerId,
    sender: shownSender(row),
  };
}

const requireMessagingMember = Effect.fn("requireMessagingMember")(function* requireMessagingMember(
  userId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), messagingMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new MessagingMemberRequired();
  }
  return member;
});

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

const unreadCountFor = Effect.fn("unreadCountFor")(function* unreadCountFor(
  viewerId: string,
  conversationId: string,
) {
  const [membership] = yield* query((database) =>
    database
      .select({ lastReadAt: conversationParticipant.lastReadAt })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.memberId, viewerId),
        ),
      )
      .limit(1),
  );
  const readAt = membership?.lastReadAt ?? new Date(0);
  const [row] = yield* query((database) =>
    database
      .select({ unread: count() })
      .from(directMessage)
      .where(
        and(
          eq(directMessage.conversationId, conversationId),
          gt(directMessage.createdAt, readAt),
          or(isNull(directMessage.senderId), ne(directMessage.senderId, viewerId)),
        ),
      ),
  );
  return row?.unread ?? 0;
});

const listGroupConversations = Effect.fn("listGroupConversations")(function* listGroupConversations(
  viewerId: string,
  page: Page,
) {
  yield* requireMessagingMember(viewerId);
  const memberships = yield* query((database) =>
    database
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.memberId, viewerId)),
  );
  const summaries: ConversationSummary[] = [];
  for (const membership of memberships) {
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
        .where(eq(directMessage.conversationId, membership.conversationId))
        .orderBy(desc(directMessage.createdAt), desc(directMessage.id))
        .limit(1),
    );
    const unreadCount = yield* unreadCountFor(viewerId, membership.conversationId);
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
  page: Page,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireGroupParticipant(viewerId, conversationId);
  const target = yield* groupTargetOf(conversationId);
  const [thread] = yield* query((database) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(and(eq(conversation.id, conversationId), eq(conversation.kind, groupConversationKind)))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  const messages = yield* query((database) =>
    database
      .select({
        body: directMessage.body,
        createdAt: directMessage.createdAt,
        id: directMessage.id,
        senderId: directMessage.senderId,
        senderName: directMessage.senderName,
      })
      .from(directMessage)
      .where(eq(directMessage.conversationId, conversationId))
      .orderBy(directMessage.createdAt, directMessage.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(directMessage)
      .where(eq(directMessage.conversationId, conversationId)),
  );
  const conversationView: ConversationView = {
    group: target.group,
    id: conversationId,
    kind: groupConversationKind,
    total: total?.count ?? 0,
  };
  return {
    conversation: conversationView,
    messages: messages.map((message) => shownMessage(viewerId, message)),
    total: total?.count ?? 0,
  };
});

const insertMessage = Effect.fn("insertMessage")(function* insertMessage(
  senderId: string,
  senderName: string,
  conversationId: string,
  body: string,
) {
  const now = yield* clockDate;
  const messageId = crypto.randomUUID();
  yield* query((database) =>
    database.batch([
      database.insert(directMessage).values({
        body,
        conversationId,
        createdAt: now,
        id: messageId,
        senderId,
        senderName,
      }),
      database
        .update(conversation)
        .set({ lastMessageAt: now })
        .where(eq(conversation.id, conversationId)),
    ]),
  );
  return messageId;
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
  const [thread] = yield* query((database) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(and(eq(conversation.id, conversationId), eq(conversation.kind, groupConversationKind)))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  return yield* insertMessage(sender.id, sender.name, conversationId, body);
});

const markConversationRead = Effect.fn("markConversationRead")(function* markConversationRead(
  viewerId: string,
  conversationId: string,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireGroupParticipant(viewerId, conversationId);
  const now = yield* clockDate;
  yield* query((database) =>
    database
      .update(conversationParticipant)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.memberId, viewerId),
        ),
      ),
  );
});

const totalUnreadCount = Effect.fn("totalUnreadCount")(function* totalUnreadCount(
  viewerId: string,
) {
  yield* requireMessagingMember(viewerId);
  const memberships = yield* query((database) =>
    database
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.memberId, viewerId)),
  );
  let unread = 0;
  for (const membership of memberships) {
    const [thread] = yield* query((database) =>
      database
        .select({ id: conversation.id })
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
    unread += yield* unreadCountFor(viewerId, membership.conversationId);
  }
  return unread;
});

export {
  findGroupConversation,
  listGroupConversations,
  markConversationRead,
  sendGroupMessage,
  totalUnreadCount,
};
