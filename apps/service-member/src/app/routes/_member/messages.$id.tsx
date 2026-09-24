import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import {
  ConversationFailed,
  ConversationMissing,
  ConversationPending,
  ConversationRoute,
  InvalidMessagesSearch,
  loadConversation,
  normalizeConversationSearch,
} from "#pages/messages/index.ts";

import type { ConversationSearch } from "#pages/messages/index.ts";

function requireConversationSearch(raw: unknown): ConversationSearch {
  try {
    return normalizeConversationSearch(raw);
  } catch (error) {
    if (Schema.is(InvalidMessagesSearch)(error)) {
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
    params: Readonly<{ id: string }>;
    search: ConversationSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ params, replace: true, search, to: "/messages/$id" });
    }
  },
  loader: ({
    deps,
    params,
  }: Readonly<{ deps: Readonly<{ page: number }>; params: Readonly<{ id: string }> }>) =>
    loadConversation(params.id, deps.page),
  component: ConversationRoute,
  errorComponent: ConversationFailed,
  notFoundComponent: ConversationMissing,
  pendingComponent: ConversationPending,
});

export { Route };
