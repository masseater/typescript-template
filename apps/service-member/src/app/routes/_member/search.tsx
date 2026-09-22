import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import {
  InvalidUsersSearch,
  PaidPlanRequired,
  SearchRoute,
  UsersFailed,
  UsersPending,
  membersOptions,
  normalizeUsersSearch,
} from "#pages/users/index.ts";

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
    if (Schema.is(InvalidUsersSearch)(error)) {
      throw redirect({ replace: true, search: {}, to: "/search" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/search")({
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
      throw redirect({ replace: true, search: normalized, to: "/search" });
    }
  },
  loader: ({
    context,
    deps,
  }: Readonly<{ context: Readonly<{ queryClient: QueryClient }>; deps: UsersSearch }>) =>
    context.queryClient.ensureInfiniteQueryData(membersOptions(deps)).catch((error: unknown) => {
      if (Schema.is(PaidPlanRequired)(error)) {
        throw redirect({ replace: true, search: {}, to: "/upgrade" });
      }
      throw error;
    }),
  component: SearchRoute,
  errorComponent: UsersFailed,
  pendingComponent: UsersPending,
});

export { Route };
