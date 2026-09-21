import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  ConversationList,
  ConversationListQuery,
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
  findGroupConversation,
  listGroupConversations,
  markConversationRead,
  sendGroupMessage,
  totalUnreadCount,
} from "./messaging.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
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
            const list = yield* listGroupConversations(user.id, {
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
            const found = yield* findGroupConversation(user.id, id, {
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
      "/messages",
      api.route(
        MessageSent,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { body, conversationId } = yield* readJsonBody(MessageSend, request);
            return { id: yield* sendGroupMessage(user.id, conversationId, body) };
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
