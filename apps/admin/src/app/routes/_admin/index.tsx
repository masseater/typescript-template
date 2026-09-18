import { createFileRoute } from "@tanstack/react-router";

import { UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_admin/")({
  component: UsersPage,
  validateSearch: normalizeUsersSearch,
});

export { Route };
