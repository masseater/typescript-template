import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import {
  ConversationList,
  ConversationView,
  GroupCreate,
  GroupCreated,
  MessageSent,
} from "#shared/contracts/index.ts";

type ConversationListView = typeof ConversationList.Type;
type ConversationThread = typeof ConversationView.Type;
type GroupJoinPolicy = (typeof GroupCreate.Type)["joinPolicy"];

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

async function sendMessage(conversationId: string, body: string): Promise<string> {
  const { api } = await userClient();
  return apiData(MessageSent, await api.messages.messages.post({ body, conversationId })).id;
}

async function createGroup(
  name: string,
  joinPolicy: GroupJoinPolicy,
): Promise<{ conversationId: string; groupId: string; inviteToken: string }> {
  const { api } = await userClient();
  const created = apiData(GroupCreated, await api.groups.create.post({ joinPolicy, name }));
  return {
    conversationId: created.conversationId,
    groupId: created.groupId,
    inviteToken: created.inviteToken,
  };
}

export { createGroup, loadConversation, loadConversations, sendMessage };
export type { ConversationListView, ConversationThread, GroupJoinPolicy };
