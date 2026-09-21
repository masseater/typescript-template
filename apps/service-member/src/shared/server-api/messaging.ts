import { CONVERSATION_KIND, ROLE } from "@repo/config";
import { pairBlocked, query, requirePaid, schema } from "@repo/db";
import { and, count, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { MessagingBlocked } from "./messaging-blocked.ts";
import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { conversation, conversationParticipant, directMessage, user } = schema;

const withdrawnSenderLabel = "退会した会員";

interface Page {
  readonly limit: number;
  readonly offset: number;
}

interface MessageSender {
  readonly id: string | null;
  readonly name: string;
}

interface DirectMessageView {
  readonly body: string;
  readonly createdAt: number;
  readonly id: string;
  readonly mine: boolean;
  readonly sender: MessageSender;
}

interface ConversationPeer {
  readonly id: string;
  readonly name: string;
  readonly withdrawn: boolean;
}

interface ConversationSummary {
  readonly id: string;
  readonly kind: "direct";
  readonly lastMessageAt: number;
  readonly lastMessagePreview: string;
  readonly peer: ConversationPeer;
  readonly unreadCount: number;
}

interface ConversationView {
  readonly blocked: boolean;
  readonly id: string;
  readonly peer: ConversationPeer;
  readonly total: number;
}

const messagingMember = and(
  eq(user.role, ROLE.member),
  eq(user.emailVerified, true),
  eq(user.suspended, false),
);
const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

function directKeyFor(memberA: string, memberB: string): string {
  return [memberA, memberB].sort((left, right) => left.localeCompare(right)).join(":");
}

function firstLine(body: string): string {
  const [line] = body.split("\n");
  return line ?? "";
}

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
): DirectMessageView {
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

const requireParticipant = Effect.fn("requireParticipant")(function* requireParticipant(
  viewerId: string,
  conversationId: string,
) {
  const [membership] = yield* query((database) =>
    database
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.memberId, viewerId),
        ),
      )
      .limit(1),
  );
  if (membership === undefined) {
    return yield* new MessagingConversationNotFound();
  }
});

const findDirectConversationId = Effect.fn("findDirectConversationId")(
  function* findDirectConversationId(memberA: string, memberB: string) {
    const [row] = yield* query((database) =>
      database
        .select({ id: conversation.id })
        .from(conversation)
        .where(eq(conversation.directKey, directKeyFor(memberA, memberB)))
        .limit(1),
    );
    return row?.id;
  },
);

const peerOf = Effect.fn("peerOf")(function* peerOf(viewerId: string, conversationId: string) {
  const participants = yield* query((database) =>
    database
      .select({
        liveName: user.name,
        memberId: conversationParticipant.memberId,
        memberName: conversationParticipant.memberName,
      })
      .from(conversationParticipant)
      .leftJoin(user, and(eq(user.id, conversationParticipant.memberId), messagingMember))
      .where(eq(conversationParticipant.conversationId, conversationId)),
  );
  const viewerMembership = participants.find((row) => row.memberId === viewerId);
  if (viewerMembership === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  const peer = participants.find((row) => row !== viewerMembership);
  if (peer === undefined || peer.memberId === null) {
    return {
      id: conversationId,
      name: withdrawnSenderLabel,
      withdrawn: true,
    } satisfies ConversationPeer;
  }
  return {
    id: peer.memberId,
    name: peer.liveName ?? peer.memberName,
    withdrawn: false,
  } satisfies ConversationPeer;
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

const listDirectConversations = Effect.fn("listDirectConversations")(
  function* listDirectConversations(viewerId: string, page: Page) {
    yield* requireMessagingMember(viewerId);
    const memberships = yield* query((database) =>
      database
        .select({ conversationId: conversationParticipant.conversationId })
        .from(conversationParticipant)
        .innerJoin(
          conversation,
          and(
            eq(conversation.id, conversationParticipant.conversationId),
            eq(conversation.kind, CONVERSATION_KIND.direct),
          ),
        )
        .where(eq(conversationParticipant.memberId, viewerId))
        .orderBy(desc(conversation.lastMessageAt), desc(conversation.id)),
    );
    const summaries: ConversationSummary[] = [];
    for (const membership of memberships) {
      const peer = yield* peerOf(viewerId, membership.conversationId);
      const [thread] = yield* query((database) =>
        database
          .select({
            id: conversation.id,
            lastMessageAt: conversation.lastMessageAt,
          })
          .from(conversation)
          .where(eq(conversation.id, membership.conversationId))
          .limit(1),
      );
      if (thread === undefined) {
        continue;
      }
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
        id: thread.id,
        kind: CONVERSATION_KIND.direct,
        lastMessageAt: thread.lastMessageAt.getTime(),
        lastMessagePreview: firstLine(lastMessage?.body ?? ""),
        peer,
        unreadCount,
      });
    }
    return {
      conversations: summaries.slice(page.offset, page.offset + page.limit),
      total: summaries.length,
    };
  },
);

const findDirectConversation = Effect.fn("findDirectConversation")(function* findDirectConversation(
  viewerId: string,
  conversationId: string,
  page: Page,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireParticipant(viewerId, conversationId);
  const peer = yield* peerOf(viewerId, conversationId);
  const [thread] = yield* query((database) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(
        and(eq(conversation.id, conversationId), eq(conversation.kind, CONVERSATION_KIND.direct)),
      )
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
    blocked: peer.withdrawn ? false : yield* pairBlocked(viewerId, peer.id),
    id: conversationId,
    peer,
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

const openDirectConversation = Effect.fn("openDirectConversation")(function* openDirectConversation(
  senderId: string,
  recipientId: string,
  body: string,
) {
  const sender = yield* requireMessagingMember(senderId);
  const [recipient] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, recipientId), messagingMember))
      .limit(1),
  );
  if (recipient === undefined || recipient.id === senderId) {
    return yield* new MessagingConversationNotFound();
  }
  if (yield* pairBlocked(senderId, recipientId)) {
    return yield* new MessagingBlocked();
  }
  const existingId = yield* findDirectConversationId(senderId, recipientId);
  if (existingId === undefined) {
    yield* requirePaid(senderId);
    const now = yield* clockDate;
    const conversationId = crypto.randomUUID();
    yield* query((database) =>
      database.batch([
        database.insert(conversation).values({
          directKey: directKeyFor(senderId, recipientId),
          id: conversationId,
          kind: CONVERSATION_KIND.direct,
          lastMessageAt: now,
        }),
        database.insert(conversationParticipant).values({
          conversationId,
          joinedAt: now,
          lastReadAt: now,
          memberId: senderId,
          memberName: sender.name,
        }),
        database.insert(conversationParticipant).values({
          conversationId,
          joinedAt: now,
          memberId: recipientId,
          memberName: recipient.name,
        }),
      ]),
    );
    const messageId = yield* insertMessage(sender.id, sender.name, conversationId, body);
    return { conversationId, messageId };
  }
  yield* requireParticipant(senderId, existingId);
  const messageId = yield* insertMessage(sender.id, sender.name, existingId, body);
  return { conversationId: existingId, messageId };
});

const sendDirectMessage = Effect.fn("sendDirectMessage")(function* sendDirectMessage(
  senderId: string,
  conversationId: string,
  body: string,
) {
  const sender = yield* requireMessagingMember(senderId);
  yield* requireParticipant(senderId, conversationId);
  const peer = yield* peerOf(senderId, conversationId);
  if (!peer.withdrawn && (yield* pairBlocked(senderId, peer.id))) {
    return yield* new MessagingBlocked();
  }
  const messageId = yield* insertMessage(sender.id, sender.name, conversationId, body);
  return messageId;
});

const markConversationRead = Effect.fn("markConversationRead")(function* markConversationRead(
  viewerId: string,
  conversationId: string,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireParticipant(viewerId, conversationId);
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

const lookupDirectConversation = Effect.fn("lookupDirectConversation")(
  function* lookupDirectConversation(viewerId: string, peerId: string) {
    yield* requireMessagingMember(viewerId);
    const conversationId = yield* findDirectConversationId(viewerId, peerId);
    if (conversationId === undefined) {
      return undefined;
    }
    yield* requireParticipant(viewerId, conversationId);
    return conversationId;
  },
);

export {
  findDirectConversation,
  listDirectConversations,
  lookupDirectConversation,
  markConversationRead,
  openDirectConversation,
  sendDirectMessage,
};
