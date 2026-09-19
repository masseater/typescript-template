import { createFileRoute, redirect } from "@tanstack/react-router";
import { Option } from "effect";

import { UsersPage, decodeUsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_admin/")({
  component: UsersPage,
  validateSearch: (search: unknown) =>
    Option.getOrElse(decodeUsersSearch(search), () => {
      throw redirect({ replace: true, search: {} });
    }),
});

export { Route };
