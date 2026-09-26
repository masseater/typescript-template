import { and, desc, eq, pairBlocked, query, requirePaid, schema } from "@repo/db";
import { Effect } from "effect";

import {
  conversationKindOf,
  directConversationKind,
  groupConversationKind,
  insertMessage,
  memberships,
  requireConversationKind,
  threadPage,
  unreadCountFor,
  withdrawnSenderLabel,
} from "./conversation-thread.ts";
import {
  findGroupConversation,
  listGroupConversations,
  requireGroupParticipant,
  sendGroupMessage,
} from "./group-conversation.ts";
import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { clockDate, requireMessagingMember, verifiedMember } from "./verified-member.ts";

import type { OffsetPage } from "./verified-member.ts";

const { conversation, conversationParticipant, directMessage, user } = schema;

interface ConversationPeer {
  readonly id: string | null;
  readonly name: string;
  readonly withdrawn: boolean;
}

interface DirectConversationSummary {
  readonly id: string;
  readonly kind: typeof directConversationKind;
  readonly lastMessageAt: number;
  readonly lastMessagePreview: string;
  readonly peer: ConversationPeer;
  readonly unreadCount: number;
}

interface DirectConversationView {
  readonly id: string;
  readonly kind: typeof directConversationKind;
  readonly peer: ConversationPeer;
  readonly total: number;
}

function directKeyFor(memberA: string, memberB: string): string {
  return [memberA, memberB].sort((left, right) => left.localeCompare(right)).join(":");
}

function firstLine(body: string): string {
  const [line] = body.split("\n");
  return line ?? "";
}

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
      .leftJoin(user, and(eq(user.id, conversationParticipant.memberId), verifiedMember))
      .where(eq(conversationParticipant.conversationId, conversationId)),
  );
  const viewerMembership = participants.find((row) => row.memberId === viewerId);
  if (viewerMembership === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  const peer = participants.find((row) => row !== viewerMembership);
  if (peer?.memberId === undefined || peer.memberId === null) {
    return {
      id: null,
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

const listDirectConversations = Effect.fn("listDirectConversations")(
  function* listDirectConversations(viewerId: string, page: OffsetPage) {
    yield* requireMessagingMember(viewerId);
    const memberships = yield* query((database) =>
      database
        .select({ conversationId: conversationParticipant.conversationId })
        .from(conversationParticipant)
        .innerJoin(
          conversation,
          and(
            eq(conversation.id, conversationParticipant.conversationId),
            eq(conversation.kind, directConversationKind),
          ),
        )
        .where(eq(conversationParticipant.memberId, viewerId))
        .orderBy(desc(conversation.lastMessageAt), desc(conversation.id)),
    );
    const summaries: DirectConversationSummary[] = [];
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
      const unreadCount = yield* unreadCountFor(viewerId, membership.conversationId, false);
      summaries.push({
        id: thread.id,
        kind: directConversationKind,
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

const listInbox = Effect.fn("listInbox")(function* listInbox(viewerId: string, page: OffsetPage) {
  const directs = yield* listDirectConversations(viewerId, { limit: 1_000_000, offset: 0 });
  const groups = yield* listGroupConversations(viewerId, { limit: 1_000_000, offset: 0 });
  const conversations = [...directs.conversations, ...groups.conversations].sort(
    (left, right) => right.lastMessageAt - left.lastMessageAt || right.id.localeCompare(left.id),
  );
  return {
    conversations: conversations.slice(page.offset, page.offset + page.limit),
    total: conversations.length,
  };
});

const findDirectConversation = Effect.fn("findDirectConversation")(function* findDirectConversation(
  viewerId: string,
  conversationId: string,
  page: OffsetPage,
) {
  yield* requireMessagingMember(viewerId);
  yield* requireParticipant(viewerId, conversationId);
  const peer = yield* peerOf(viewerId, conversationId);
  yield* requireConversationKind(conversationId, directConversationKind);
  const thread = yield* threadPage(viewerId, conversationId, page, false);
  const conversationView: DirectConversationView = {
    id: conversationId,
    kind: directConversationKind,
    peer,
    total: thread.total,
  };
  return { conversation: conversationView, ...thread };
});

const findConversation = Effect.fn("findConversation")(function* findConversation(
  viewerId: string,
  conversationId: string,
  page: OffsetPage,
) {
  if ((yield* conversationKindOf(conversationId)) === directConversationKind) {
    return yield* findDirectConversation(viewerId, conversationId, page);
  }
  return yield* findGroupConversation(viewerId, conversationId, page);
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
      .where(and(eq(user.id, recipientId), verifiedMember))
      .limit(1),
  );
  if (recipient === undefined || recipient.id === senderId) {
    return yield* new MessagingConversationNotFound();
  }
  if (yield* pairBlocked(senderId, recipientId)) {
    return yield* new MessagingConversationNotFound();
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
          kind: directConversationKind,
          lastMessageAt: now,
        }),
        database.insert(conversationParticipant).values({
          conversationId,
          id: crypto.randomUUID(),
          joinedAt: now,
          lastReadAt: now,
          memberId: senderId,
          memberName: sender.name,
        }),
        database.insert(conversationParticipant).values({
          conversationId,
          id: crypto.randomUUID(),
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
  if (!peer.withdrawn && peer.id !== null && (yield* pairBlocked(senderId, peer.id))) {
    return yield* new MessagingConversationNotFound();
  }
  yield* requireConversationKind(conversationId, directConversationKind);
  return yield* insertMessage(sender.id, sender.name, conversationId, body);
});

const sendConversationMessage = Effect.fn("sendConversationMessage")(
  function* sendConversationMessage(senderId: string, conversationId: string, body: string) {
    if ((yield* conversationKindOf(conversationId)) === directConversationKind) {
      return yield* sendDirectMessage(senderId, conversationId, body);
    }
    return yield* sendGroupMessage(senderId, conversationId, body);
  },
);

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

const markConversationRead = Effect.fn("markConversationRead")(function* markConversationRead(
  viewerId: string,
  conversationId: string,
) {
  yield* requireMessagingMember(viewerId);
  if ((yield* conversationKindOf(conversationId)) === directConversationKind) {
    yield* requireParticipant(viewerId, conversationId);
  } else {
    yield* requireGroupParticipant(viewerId, conversationId);
  }
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
  let unread = 0;
  for (const membership of yield* memberships(viewerId)) {
    const [thread] = yield* query((database) =>
      database
        .select({ id: conversation.id, kind: conversation.kind })
        .from(conversation)
        .where(eq(conversation.id, membership.conversationId))
        .limit(1),
    );
    if (thread === undefined) {
      continue;
    }
    unread += yield* unreadCountFor(
      viewerId,
      membership.conversationId,
      thread.kind === groupConversationKind,
    );
  }
  return unread;
});

export {
  findConversation,
  listInbox,
  lookupDirectConversation,
  markConversationRead,
  openDirectConversation,
  sendConversationMessage,
  sendDirectMessage,
  totalUnreadCount,
};
