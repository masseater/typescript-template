import { UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_admin/")({
  component: UsersPage,
  validateSearch: normalizeUsersSearch,
});

export { Route };
