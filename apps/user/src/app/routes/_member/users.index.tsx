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
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ replace: true, search, to: "/users" });
    }
  },
  loader: async ({ deps }: Readonly<{ deps: UsersSearch }>) => loadMembers(deps),
  component: UsersRoute,
  errorComponent: UsersFailed,
  pendingComponent: UsersPending,
});

export { Route };
