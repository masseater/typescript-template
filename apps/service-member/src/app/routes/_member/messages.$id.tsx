import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  ConversationFailed,
  ConversationMissing,
  ConversationPending,
  InvalidMessagesSearch,
  loadConversation,
  normalizeConversationSearch,
} from "#pages/messages/index.ts";
import { ConversationRoute } from "./-conversation-route.tsx";

import type { ConversationSearch } from "#pages/messages/index.ts";

type ConversationParams = Readonly<{ id: string }>;

function requireConversationSearch(raw: unknown): ConversationSearch {
  try {
    return normalizeConversationSearch(raw);
  } catch (error) {
    if (error instanceof InvalidMessagesSearch) {
      throw redirect({ replace: true, search: {}, to: "/messages" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/messages/$id")({
  validateSearch: requireConversationSearch,
  loaderDeps: ({ search }: Readonly<{ search: ConversationSearch }>) => ({
    page: search.page ?? 1,
  }),
  beforeLoad: ({
    location,
    params,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    params: ConversationParams;
    search: ConversationSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ params, replace: true, search, to: "/messages/$id" });
    }
  },
  loader: async ({
    deps,
    params,
  }: Readonly<{ deps: Readonly<{ page: number }>; params: ConversationParams }>) =>
    loadConversation(params.id, deps.page),
  component: ConversationRoute,
  errorComponent: ConversationFailed,
  notFoundComponent: ConversationMissing,
  pendingComponent: ConversationPending,
});

export { Route };
