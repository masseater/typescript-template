import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

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

function requireUsersSearch(raw: unknown): UsersSearch {
  try {
    return normalizeUsersSearch(raw);
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
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/search" });
    }
  },
  loader: ({ deps }: Readonly<{ deps: UsersSearch }>) =>
    loadMembers(deps).catch((error: unknown) => {
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
