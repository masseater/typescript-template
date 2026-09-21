import { ROLE } from "@repo/config";
import { CONVERSATION_KIND, blockBetween, pairBlocked, query, requirePaid, schema } from "@repo/db";
import { and, count, desc, eq, gt, isNull, ne, not, or, sql } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { maySendGroupMessage } from "#shared/messaging/index.ts";
import { canReadGroupConversation, groupIdForConversation } from "./groups.ts";
import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { conversation, conversationParticipant, directMessage, memberGroup, user } = schema;

const groupConversationKind = CONVERSATION_KIND.group;
const directConversationKind = CONVERSATION_KIND.direct;
const withdrawnSenderLabel = "退会した会員";

function visibleInThread(viewerId: string, conversationId: string, hideBlocked: boolean) {
  const inThread = eq(directMessage.conversationId, conversationId);
  if (!hideBlocked) {
    return inThread;
  }
  return and(inThread, not(blockBetween(viewerId, sql`${directMessage.senderId}`)));
}

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
  hideBlocked: boolean,
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
          visibleInThread(viewerId, conversationId, hideBlocked),
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
      .where(visibleInThread(viewerId, conversationId, true))
      .orderBy(directMessage.createdAt, directMessage.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(directMessage)
      .where(visibleInThread(viewerId, conversationId, true)),
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

const listInbox = Effect.fn("listInbox")(function* listInbox(viewerId: string, page: Page) {
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
        and(eq(conversation.id, conversationId), eq(conversation.kind, directConversationKind)),
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
  const conversationView: DirectConversationView = {
    id: conversationId,
    kind: directConversationKind,
    peer,
    total: total?.count ?? 0,
  };
  return {
    conversation: conversationView,
    messages: messages.map((message) => shownMessage(viewerId, message)),
    total: total?.count ?? 0,
  };
});

const findConversation = Effect.fn("findConversation")(function* findConversation(
  viewerId: string,
  conversationId: string,
  page: Page,
) {
  const [thread] = yield* query((database) =>
    database
      .select({ kind: conversation.kind })
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  if (thread.kind === directConversationKind) {
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
      .where(and(eq(user.id, recipientId), messagingMember))
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
  const [thread] = yield* query((database) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(
        and(eq(conversation.id, conversationId), eq(conversation.kind, directConversationKind)),
      )
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  return yield* insertMessage(sender.id, sender.name, conversationId, body);
});

const sendConversationMessage = Effect.fn("sendConversationMessage")(
  function* sendConversationMessage(senderId: string, conversationId: string, body: string) {
    const [thread] = yield* query((database) =>
      database
        .select({ kind: conversation.kind })
        .from(conversation)
        .where(eq(conversation.id, conversationId))
        .limit(1),
    );
    if (thread === undefined) {
      return yield* new MessagingConversationNotFound();
    }
    if (thread.kind === directConversationKind) {
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
  const [thread] = yield* query((database) =>
    database
      .select({ kind: conversation.kind })
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new MessagingConversationNotFound();
  }
  if (thread.kind === directConversationKind) {
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
  findDirectConversation,
  findGroupConversation,
  listDirectConversations,
  listGroupConversations,
  listInbox,
  lookupDirectConversation,
  markConversationRead,
  openDirectConversation,
  sendConversationMessage,
  sendDirectMessage,
  sendGroupMessage,
  totalUnreadCount,
};
