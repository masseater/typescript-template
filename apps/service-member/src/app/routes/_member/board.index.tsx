import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  BoardFailed,
  BoardPending,
  InvalidBoardSearch,
  loadThreads,
  normalizeBoardSearch,
} from "#pages/board/index.ts";
import { BoardRoute } from "./-board-route.tsx";

import type { BoardSearch } from "#pages/board/index.ts";

function requireBoardSearch(raw: unknown): BoardSearch {
  try {
    return normalizeBoardSearch(raw);
  } catch (error) {
    if (error instanceof InvalidBoardSearch) {
      throw redirect({ replace: true, search: {}, to: "/board" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/board/")({
  validateSearch: requireBoardSearch,
  loaderDeps: ({ search }: Readonly<{ search: BoardSearch }>) => ({ page: search.page ?? 1 }),
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    search: BoardSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/board" });
    }
  },
  loader: async ({ deps }: Readonly<{ deps: Readonly<{ page: number }> }>) =>
    loadThreads(deps.page),
  component: BoardRoute,
  errorComponent: BoardFailed,
  pendingComponent: BoardPending,
});

export { Route };
