import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidUsersSearch,
  PaidPlanRequired,
  UsersFailed,
  UsersPending,
  membersOptions,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { UsersRoute } from "./-users-route.tsx";

import type { UsersSearch } from "#pages/users/index.ts";
import type { QueryClient } from "@tanstack/react-query";

function withoutPage(search: UsersSearch): UsersSearch {
  if (search.page === undefined) {
    return search;
  }
  const { page: _page, ...filters } = search;
  return filters;
}

function requireUsersSearch(raw: unknown): UsersSearch {
  try {
    return withoutPage(normalizeUsersSearch(raw));
  } catch (error) {
    if (error instanceof InvalidUsersSearch) {
      throw redirect({ replace: true, search: {}, to: "/users" });
    }
    throw error;
  }
}

async function loadMembersOrUpgrade(queries: QueryClient, search: UsersSearch) {
  try {
    return await queries.ensureInfiniteQueryData(membersOptions(search));
  } catch (error) {
    if (error instanceof PaidPlanRequired) {
      throw redirect({ replace: true, search: {}, to: "/upgrade" });
    }
    throw error;
  }
}

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/users/")({
  validateSearch: requireUsersSearch,
  loaderDeps: ({ search }: Readonly<{ search: UsersSearch }>) => search,
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    search: UsersSearch;
  }>) => {
    const normalized = withoutPage(search);
    if (location.searchStr !== defaultStringifySearch(normalized)) {
      throw redirect({ replace: true, search: normalized, to: "/users" });
    }
  },
  loader: async ({
    context,
    deps,
  }: Readonly<{ context: Readonly<{ queryClient: QueryClient }>; deps: UsersSearch }>) =>
    loadMembersOrUpgrade(context.queryClient, deps),
  component: UsersRoute,
  errorComponent: UsersFailed,
  pendingComponent: UsersPending,
});

export { Route };
