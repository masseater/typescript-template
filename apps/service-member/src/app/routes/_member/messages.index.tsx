import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidMessagesSearch,
  MessagesFailed,
  MessagesPending,
  loadConversations,
  normalizeMessagesSearch,
} from "#pages/messages/index.ts";
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

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/messages/")({
  validateSearch: requireMessagesSearch,
  loaderDeps: ({ search }: Readonly<{ search: MessagesSearch }>) => ({ page: search.page ?? 1 }),
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
  loader: async ({ deps }: Readonly<{ deps: Readonly<{ page: number }> }>) =>
    loadConversations(deps.page),
  component: MessagesRoute,
  errorComponent: MessagesFailed,
  pendingComponent: MessagesPending,
});

export { Route };
