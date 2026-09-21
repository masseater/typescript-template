import { createFileRoute, redirect } from "@tanstack/react-router";

import { InvalidUsersSearch, normalizeUsersSearch } from "#pages/users/index.ts";

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

const Route = createFileRoute("/_member/users/")({
  validateSearch: requireSearch,
  beforeLoad: ({ search }: Readonly<{ search: UsersSearch }>) => {
    throw redirect({ replace: true, search, to: "/search" });
  },
});

export { Route };
