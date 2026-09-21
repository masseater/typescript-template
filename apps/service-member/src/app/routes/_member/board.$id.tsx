import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidBoardSearch,
  ThreadFailed,
  ThreadMissing,
  ThreadPending,
  loadThread,
  normalizeThreadSearch,
} from "#pages/board/index.ts";
import { ThreadRoute } from "./-thread-route.tsx";

import type { ThreadSearch } from "#pages/board/index.ts";

type ThreadParams = Readonly<{ id: string }>;

function requireThreadSearch(raw: unknown): ThreadSearch {
  try {
    return normalizeThreadSearch(raw);
  } catch (error) {
    if (error instanceof InvalidBoardSearch) {
      throw redirect({ replace: true, search: {}, to: "/board" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/board/$id")({
  beforeLoad: ({
    location,
    params,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    params: ThreadParams;
    search: ThreadSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ params, replace: true, search, to: "/board/$id" });
    }
  },
  component: ThreadRoute,
  errorComponent: ThreadFailed,
  loader: async ({
    deps,
    params,
  }: Readonly<{ deps: Readonly<{ page: number }>; params: ThreadParams }>) =>
    loadThread(params.id, deps.page),
  loaderDeps: ({ search }: Readonly<{ search: ThreadSearch }>) => ({ page: search.page ?? 1 }),
  notFoundComponent: ThreadMissing,
  pendingComponent: ThreadPending,
  validateSearch: requireThreadSearch,
});

export { Route };
