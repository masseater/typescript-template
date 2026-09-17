import {
  UsersFailed,
  UsersPending,
  loadMembers,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UsersRoute } from "./-users-route.tsx";
import { isEqual } from "es-toolkit";

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({
    location,
    search,
  }: Readonly<{
    location: Readonly<{ search: unknown }>;
    search: Readonly<Record<string, unknown>>;
  }>) => {
    if (!isEqual(location.search, search)) {
      throw redirect({ replace: true, search, to: "/users" });
    }
  },
  component: UsersRoute,
  errorComponent: UsersFailed,
  loader: async ({ deps }: Readonly<{ deps: ReturnType<typeof normalizeUsersSearch> }>) =>
    loadMembers(deps),
  loaderDeps: ({ search }: Readonly<{ search: ReturnType<typeof normalizeUsersSearch> }>) => search,
  pendingComponent: UsersPending,
  validateSearch: normalizeUsersSearch,
});

export { Route };
