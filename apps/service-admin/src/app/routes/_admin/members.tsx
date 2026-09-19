import { createFileRoute, redirect } from "@tanstack/react-router";

import { InvalidUsersSearch, UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_admin/members")({
  component: UsersPage,
  validateSearch: (search: unknown) => {
    try {
      return normalizeUsersSearch(search);
    } catch (error) {
      if (error instanceof InvalidUsersSearch) {
        throw redirect({ replace: true, search: {}, to: "/members" });
      }
      throw error;
    }
  },
});

export { Route };
