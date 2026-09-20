import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  InvalidUsersSearch,
  UsersFailed,
  UsersPending,
  loadMembers,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { UsersRoute } from "./-users-route.tsx";

import type { UsersSearch } from "#pages/users/index.ts";

function requireUsersSearch(raw: unknown): UsersSearch {
  try {
    return normalizeUsersSearch(raw);
  } catch (error) {
    if (error instanceof InvalidUsersSearch) {
      throw redirect({ replace: true, search: {}, to: "/users" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    search: UsersSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/users" });
    }
  },
  component: UsersRoute,
  errorComponent: UsersFailed,
  loader: async ({ deps }: Readonly<{ deps: UsersSearch }>) => loadMembers(deps),
  loaderDeps: ({ search }: Readonly<{ search: UsersSearch }>) => search,
  pendingComponent: UsersPending,
  validateSearch: requireUsersSearch,
});

export { Route };
