import {
  UsersFailed,
  UsersPending,
  membersOptions,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import type { RouterContext } from "#app/router-context.ts";
import { UsersRoute } from "./-users-route.tsx";
import type { UsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({
    location,
    search,
  }: Readonly<{ location: Readonly<{ searchStr: string }>; search: unknown }>) => {
    const normalized = normalizeUsersSearch(search);
    if (location.searchStr !== defaultStringifySearch(normalized)) {
      throw redirect({ replace: true, search: normalized, to: "/users" });
    }
  },
  component: UsersRoute,
  errorComponent: UsersFailed,
  loader: async ({
    context,
    deps,
  }: Readonly<{ context: RouterContext; deps: UsersSearch }>): Promise<void> => {
    await context.queryClient.infiniteQuery(membersOptions(deps));
  },
  loaderDeps: ({ search }: Readonly<{ search: unknown }>) => normalizeUsersSearch(search),
  pendingComponent: UsersPending,
  validateSearch: normalizeUsersSearch,
});

export { Route };
