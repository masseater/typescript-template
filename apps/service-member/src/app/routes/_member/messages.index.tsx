import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidMessagesSearch,
  MessagesFailed,
  MessagesMissing,
  MessagesPending,
  loadConversations,
  lookupConversation,
  normalizeMessagesSearch,
} from "#pages/messages/index.ts";
import { loadMember } from "#pages/profile/index.ts";
import { MessagesRoute } from "./-messages-route.tsx";

import type { MessagesSearch } from "#pages/messages/index.ts";

function requireMessagesSearch(raw: unknown): MessagesSearch {
  try {
    return normalizeMessagesSearch(raw);
  } catch (error) {
    if (error instanceof InvalidMessagesSearch) {
      throw redirect({ replace: true, search: {}, to: "/messages" });
    }
    throw error;
  }
}

async function loadMessagesIndex(search: MessagesSearch) {
  if (search.peer !== undefined) {
    const conversationId = await lookupConversation(search.peer);
    if (conversationId !== undefined) {
      throw redirect({
        params: { id: conversationId },
        replace: true,
        search: {},
        to: "/messages/$id",
      });
    }
    const composePeer = await loadMember(search.peer);
    const list = await loadConversations(search.page ?? 1);
    return { composePeer, list };
  }
  return { list: await loadConversations(search.page ?? 1) };
}

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/messages/")({
  validateSearch: requireMessagesSearch,
  loaderDeps: ({ search }: Readonly<{ search: MessagesSearch }>) => search,
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    search: MessagesSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/messages" });
    }
  },
  loader: async ({ deps }: Readonly<{ deps: MessagesSearch }>) => loadMessagesIndex(deps),
  component: MessagesRoute,
  errorComponent: MessagesFailed,
  notFoundComponent: MessagesMissing,
  pendingComponent: MessagesPending,
});

export { Route };
