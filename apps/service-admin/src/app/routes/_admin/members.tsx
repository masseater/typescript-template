import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { InvalidUsersSearch, UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_admin/members")({
  component: UsersPage,
  validateSearch: (search: unknown) => {
    try {
      return normalizeUsersSearch(search);
    } catch (error) {
      if (Schema.is(InvalidUsersSearch)(error)) {
        throw redirect({ replace: true, search: {}, to: "/members" });
      }
      throw error;
    }
  },
});

export { Route };
