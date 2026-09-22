import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { paidFailures } from "#shared/billing/index.ts";
import {
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
  messagingConversationPageSize,
  messagingMessagePageSize,
} from "#shared/contracts/index.ts";
import {
  findConversation,
  listInbox,
  lookupDirectConversation,
  markConversationRead,
  openDirectConversation,
  sendConversationMessage,
  totalUnreadCount,
} from "./messaging.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  ...paidFailures,
  MessagingConversationNotFound: {
    message: "会話が見つかりません。",
    status: httpStatus.notFound,
  },
  MessagingMemberRequired: {
    message: "メッセージは会員だけが使えます。",
    status: httpStatus.forbidden,
  },
};

function messagingApi(api: ApiRoutes<AppServices>) {
  return createApi("/messages")
    .get(
      "/conversations",
      api.route(
        ConversationList,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { page } = yield* readSearchParams(ConversationListQuery, request);
            const list = yield* listInbox(user.id, {
              limit: messagingConversationPageSize,
              offset: (page - 1) * messagingConversationPageSize,
            });
            return { ...list, pageSize: messagingConversationPageSize };
          }),
        failures,
      ),
    )
    .get(
      "/conversation",
      api.route(
        ConversationView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id, page } = yield* readSearchParams(ConversationQuery, request);
            const found = yield* findConversation(user.id, id, {
              limit: messagingMessagePageSize,
              offset: (page - 1) * messagingMessagePageSize,
            });
            yield* markConversationRead(user.id, id);
            return { ...found, pageSize: messagingMessagePageSize };
          }),
        failures,
      ),
    )
    .get(
      "/lookup",
      api.route(
        ConversationLookupResult,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { peerId } = yield* readSearchParams(ConversationLookup, request);
            const conversationId = yield* lookupDirectConversation(user.id, peerId);
            return { conversationId: conversationId === undefined ? null : conversationId };
          }),
        failures,
      ),
    )
    .get(
      "/unread",
      api.route(
        UnreadCount,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { count: yield* totalUnreadCount(user.id) };
          }),
        failures,
      ),
    )
    .post(
      "/conversations",
      api.route(
        ConversationOpened,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { body, recipientId } = yield* readJsonBody(ConversationOpen, request);
            const opened = yield* openDirectConversation(user.id, recipientId, body);
            return { conversationId: opened.conversationId, id: opened.messageId };
          }),
        failures,
      ),
    )
    .post(
      "/messages",
      api.route(
        MessageSent,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { body, conversationId } = yield* readJsonBody(MessageSend, request);
            return { id: yield* sendConversationMessage(user.id, conversationId, body) };
          }),
        failures,
      ),
    )
    .post(
      "/read",
      api.route(
        ConversationRead,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { conversationId } = yield* readJsonBody(ConversationRead, request);
            yield* markConversationRead(user.id, conversationId);
            return { conversationId };
          }),
        failures,
      ),
    );
}

export { messagingApi };
