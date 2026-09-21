import { Schema } from "effect";

import { Identifier, pageNumber } from "./member.ts";

const maximumMessageBodyLength = 5000;
const maximumMessagingPage = 1_000_000;
const messagingConversationPageSize = 20;
const messagingMessagePageSize = 50;

const MessageSender = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
});

const MessageView = Schema.Struct({
  body: Schema.String,
  createdAt: Schema.Number,
  id: Schema.String,
  mine: Schema.Boolean,
  sender: MessageSender,
});

const ConversationPeer = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  withdrawn: Schema.Boolean,
});

const DirectConversationSummary = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("direct"),
  lastMessageAt: Schema.Number,
  lastMessagePreview: Schema.String,
  peer: ConversationPeer,
  unreadCount: Schema.Finite,
});

const GroupConversationSummary = Schema.Struct({
  group: Schema.Struct({ id: Schema.String, name: Schema.String }),
  id: Schema.String,
  kind: Schema.Literal("group"),
  lastMessageAt: Schema.Number,
  lastMessagePreview: Schema.String,
  unreadCount: Schema.Finite,
});

const ConversationSummary = Schema.Union([DirectConversationSummary, GroupConversationSummary]);

const ConversationListQuery = Schema.Struct({
  page: pageNumber(1, 1, maximumMessagingPage),
});

const ConversationList = Schema.Struct({
  conversations: Schema.Array(ConversationSummary),
  pageSize: Schema.Literal(messagingConversationPageSize),
  total: Schema.Finite,
});

const ConversationQuery = Schema.Struct({
  id: Identifier,
  page: pageNumber(1, 1, maximumMessagingPage),
});

const DirectConversationBody = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("direct"),
  peer: ConversationPeer,
  total: Schema.Finite,
});

const GroupConversationBody = Schema.Struct({
  group: Schema.Struct({ id: Schema.String, name: Schema.String }),
  id: Schema.String,
  kind: Schema.Literal("group"),
  total: Schema.Finite,
});

const ConversationView = Schema.Struct({
  conversation: Schema.Union([DirectConversationBody, GroupConversationBody]),
  messages: Schema.Array(MessageView),
  pageSize: Schema.Literal(messagingMessagePageSize),
  total: Schema.Finite,
});

const MessageBody = Schema.Trim.check(Schema.isLengthBetween(1, maximumMessageBodyLength));

const MessageSend = Schema.Struct({ body: MessageBody, conversationId: Identifier });

const MessageSent = Schema.Struct({ id: Schema.String });

const ConversationOpen = Schema.Struct({ body: MessageBody, recipientId: Identifier });

const ConversationOpened = Schema.Struct({
  conversationId: Schema.String,
  id: Schema.String,
});

const ConversationLookup = Schema.Struct({ peerId: Identifier });

const ConversationLookupResult = Schema.Struct({
  conversationId: Schema.NullOr(Schema.String),
});

const ConversationRead = Schema.Struct({ conversationId: Identifier });

const UnreadCount = Schema.Struct({ count: Schema.Finite });

export {
  ConversationList,
  ConversationListQuery,
  ConversationLookup,
  ConversationLookupResult,
  ConversationOpen,
  ConversationOpened,
  ConversationQuery,
  ConversationRead,
  ConversationView,
  MessageSend,
  MessageSent,
  UnreadCount,
  maximumMessageBodyLength,
  messagingConversationPageSize,
  messagingMessagePageSize,
};
