import { createFileRoute, redirect } from "@tanstack/react-router";

import { InvalidUsersSearch, normalizeUsersSearch } from "#pages/users/index.ts";

import type { UsersSearch } from "#pages/users/index.ts";

function usersSearchOrEmpty(raw: unknown): UsersSearch {
  try {
    return normalizeUsersSearch(raw);
  } catch (error) {
    if (error instanceof InvalidUsersSearch) {
      return {};
    }
    throw error;
  }
}

// oxlint-disable-next-line eslint/sort-keys -- TanStack Start infers search and loader dependencies from the order of these route options, and alphabetical order breaks that inference
const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({ search }) => {
    throw redirect({ replace: true, search: usersSearchOrEmpty(search), to: "/search" });
  },
});

export { Route };
