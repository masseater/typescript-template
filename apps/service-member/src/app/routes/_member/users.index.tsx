import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { InvalidUsersSearch, normalizeUsersSearch } from "#pages/users/index.ts";

import type { UsersSearch } from "#pages/users/index.ts";

function usersSearchOrEmpty(raw: unknown): UsersSearch {
  try {
    return normalizeUsersSearch(raw);
  } catch (error) {
    if (Schema.is(InvalidUsersSearch)(error)) {
      return {};
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({ search }) => {
    throw redirect({ replace: true, search: usersSearchOrEmpty(search), to: "/search" });
  },
});

export { Route };
