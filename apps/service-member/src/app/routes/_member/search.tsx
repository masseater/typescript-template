import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidUsersSearch,
  PaidPlanRequired,
  UsersFailed,
  UsersPending,
  loadMembers,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { SearchRoute } from "./-search-route.tsx";

import type { UsersSearch } from "#pages/users/index.ts";

function requireSearch(raw: unknown): UsersSearch {
  try {
    return normalizeUsersSearch(raw);
  } catch (error) {
    if (error instanceof InvalidUsersSearch) {
      throw redirect({ replace: true, search: {}, to: "/search" });
    }
    throw error;
  }
}

async function loadMembersOrUpgrade(
  search: UsersSearch,
): Promise<Awaited<ReturnType<typeof loadMembers>>> {
  try {
    return await loadMembers(search);
  } catch (error) {
    if (error instanceof PaidPlanRequired) {
      throw redirect({ replace: true, search: {}, to: "/upgrade" });
    }
    throw error;
  }
}

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/search")({
  validateSearch: requireSearch,
  loaderDeps: ({ search }: Readonly<{ search: UsersSearch }>) => search,
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    search: UsersSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/search" });
    }
  },
  loader: async ({ deps }: Readonly<{ deps: UsersSearch }>) => loadMembersOrUpgrade(deps),
  component: SearchRoute,
  errorComponent: UsersFailed,
  pendingComponent: UsersPending,
});

export { Route };
