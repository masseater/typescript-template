import { httpStatus } from "@repo/observability";
import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import {
  ConversationList,
  ConversationLookupResult,
  ConversationOpened,
  ConversationView,
  MessageSent,
} from "#shared/contracts/index.ts";

type ConversationListView = typeof ConversationList.Type;
type ConversationThread = typeof ConversationView.Type;

class PaidPlanRequired extends Error {
  override readonly name = "PaidPlanRequired";
}

function paymentRequired(reply: { readonly error?: { readonly status: number } | null }): void {
  if (reply.error?.status === httpStatus.paymentRequired) {
    throw new PaidPlanRequired();
  }
}

async function loadConversations(page: number): Promise<ConversationListView> {
  const { api } = await userClient();
  return apiData(
    ConversationList,
    await api.messages.conversations.get({ query: { page: String(page) } }),
  );
}

async function loadConversation(id: string, page: number): Promise<ConversationThread> {
  const { api } = await userClient();
  const conversation = apiDataOrNone(
    ConversationView,
    await api.messages.conversation.get({ query: { id, page: String(page) } }),
    absent.notFound,
  );
  if (conversation === undefined) {
    throw notFound();
  }
  return conversation;
}

async function lookupConversation(peerId: string): Promise<string | undefined> {
  const { api } = await userClient();
  const result = apiData(
    ConversationLookupResult,
    await api.messages.lookup.get({ query: { peerId } }),
  );
  return result.conversationId ?? undefined;
}

async function openConversation(recipientId: string, body: string): Promise<string> {
  const { api } = await userClient();
  const reply = await api.messages.conversations.post({ body, recipientId });
  paymentRequired(reply);
  return apiData(ConversationOpened, reply).conversationId;
}

async function sendMessage(conversationId: string, body: string): Promise<string> {
  const { api } = await userClient();
  return apiData(MessageSent, await api.messages.send.post({ body, conversationId })).id;
}

export {
  PaidPlanRequired,
  loadConversation,
  loadConversations,
  lookupConversation,
  openConversation,
  sendMessage,
};
export type { ConversationListView, ConversationThread };
