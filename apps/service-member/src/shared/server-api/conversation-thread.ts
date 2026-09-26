import {
  CONVERSATION_KIND,
  and,
  blockBetween,
  count,
  eq,
  gt,
  isNull,
  ne,
  not,
  or,
  query,
  schema,
} from "@repo/db";
import { DateTime, Effect } from "effect";

import { MessagingConversationNotFound } from "./messaging-conversation-not-found.ts";
import { clockDate } from "./verified-member.ts";

import type { OffsetPage } from "./verified-member.ts";

const { conversation, conversationParticipant, directMessage } = schema;

const groupConversationKind = CONVERSATION_KIND.group;

const directConversationKind = CONVERSATION_KIND.direct;

const withdrawnSenderLabel = "退会した会員";

function visibleInThread(viewerId: string, conversationId: string, hideBlocked: boolean) {
  const inThread = eq(directMessage.conversationId, conversationId);
  if (!hideBlocked) {
    return inThread;
  }
  return and(inThread, not(blockBetween(viewerId, directMessage.senderId)));
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

const memberships = (viewerId: string) =>
  query((database) =>
    database
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.memberId, viewerId)),
  );

const conversationKindOf = Effect.fn("conversationKindOf")(function* conversationKindOf(
  conversationId: string,
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
  return thread.kind;
});

const requireConversationKind = Effect.fn("requireConversationKind")(
  function* requireConversationKind(
    conversationId: string,
    kind: typeof directConversationKind | typeof groupConversationKind,
  ) {
    const [thread] = yield* query((database) =>
      database
        .select({ id: conversation.id })
        .from(conversation)
        .where(and(eq(conversation.id, conversationId), eq(conversation.kind, kind)))
        .limit(1),
    );
    if (thread === undefined) {
      return yield* new MessagingConversationNotFound();
    }
  },
);

const threadPage = Effect.fn("threadPage")(function* threadPage(
  viewerId: string,
  conversationId: string,
  page: OffsetPage,
  hideBlocked: boolean,
) {
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
      .where(visibleInThread(viewerId, conversationId, hideBlocked))
      .orderBy(directMessage.createdAt, directMessage.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(directMessage)
      .where(visibleInThread(viewerId, conversationId, hideBlocked)),
  );
  return {
    messages: messages.map((message) => shownMessage(viewerId, message)),
    total: total?.count ?? 0,
  };
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
  const readAt = membership?.lastReadAt ?? DateTime.toDate(DateTime.makeUnsafe(0));
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

export {
  conversationKindOf,
  directConversationKind,
  groupConversationKind,
  insertMessage,
  memberships,
  requireConversationKind,
  threadPage,
  unreadCountFor,
  visibleInThread,
  withdrawnSenderLabel,
};
