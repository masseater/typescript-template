import { UsersPage } from "#components/users-page.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { normalizeUsersSearch } from "#users-search.ts";

const Route = createFileRoute("/_admin/")({
  component: UsersPage,
  validateSearch: normalizeUsersSearch,
});

export { Route };
