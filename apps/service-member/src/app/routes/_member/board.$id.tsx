import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import {
  InvalidBoardSearch,
  ThreadFailed,
  ThreadMissing,
  ThreadPending,
  ThreadRoute,
  loadThread,
  normalizeThreadSearch,
} from "#pages/board/index.ts";

import type { ThreadSearch } from "#pages/board/index.ts";

type ThreadParams = Readonly<{ id: string }>;

function requireThreadSearch(raw: unknown): ThreadSearch {
  try {
    return normalizeThreadSearch(raw);
  } catch (error) {
    if (Schema.is(InvalidBoardSearch)(error)) {
      throw redirect({ replace: true, search: {}, to: "/board" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/board/$id")({
  validateSearch: requireThreadSearch,
  loaderDeps: ({ search }: Readonly<{ search: ThreadSearch }>) => ({ page: search.page ?? 1 }),
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
  loader: ({
    deps,
    params,
  }: Readonly<{ deps: Readonly<{ page: number }>; params: ThreadParams }>) =>
    loadThread(params.id, deps.page),
  component: ThreadRoute,
  errorComponent: ThreadFailed,
  notFoundComponent: ThreadMissing,
  pendingComponent: ThreadPending,
});

export { Route };
