import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  UsersFailed,
  UsersPending,
  loadMembers,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { UsersRoute } from "./-users-route.tsx";

type RawSearch = Readonly<Record<string, unknown>>;

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({
    location,
    search,
  }: Readonly<{ location: Readonly<{ searchStr: string }>; search: RawSearch }>) => {
    const normalized = normalizeUsersSearch(search);
    if (location.searchStr !== defaultStringifySearch(normalized)) {
      throw redirect({ replace: true, search: normalized, to: "/users" });
    }
  },
  component: UsersRoute,
  errorComponent: UsersFailed,
  loader: async ({ deps }: Readonly<{ deps: ReturnType<typeof normalizeUsersSearch> }>) =>
    loadMembers(deps),
  loaderDeps: ({ search }: Readonly<{ search: RawSearch }>) => normalizeUsersSearch(search),
  pendingComponent: UsersPending,
  validateSearch: normalizeUsersSearch,
});

export { Route };
