import {
  UsersFailed,
  UsersPending,
  loadMembers,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import { UsersRoute } from "./-users-route.tsx";

type RawSearch = Readonly<Record<string, unknown>>;

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/users/")({
  validateSearch: normalizeUsersSearch,
  loaderDeps: ({ search }: Readonly<{ search: RawSearch }>) => normalizeUsersSearch(search),
  beforeLoad: ({
    location,
    search,
  }: Readonly<{ location: Readonly<{ searchStr: string }>; search: RawSearch }>) => {
    const normalized = normalizeUsersSearch(search);
    if (location.searchStr !== defaultStringifySearch(normalized)) {
      throw redirect({ replace: true, search: normalized, to: "/users" });
    }
  },
  loader: async ({ deps }: Readonly<{ deps: ReturnType<typeof normalizeUsersSearch> }>) =>
    loadMembers(deps),
  component: UsersRoute,
  errorComponent: UsersFailed,
  pendingComponent: UsersPending,
});

export { Route };
