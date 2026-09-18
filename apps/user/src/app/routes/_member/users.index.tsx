import {
  UsersFailed,
  UsersPending,
  membersOptions,
  normalizeUsersSearch,
} from "#pages/users/index.ts";
import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";
import type { RouterContext } from "#app/router-context.ts";
import { UsersRoute } from "./-users-route.tsx";

type RawSearch = Readonly<Record<string, unknown>>;
type UsersSearch = ReturnType<typeof normalizeUsersSearch>;

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  loader: async ({
    context,
    deps,
  }: {
    context: RouterContext;
    deps: UsersSearch;
  }): Promise<void> => {
    await context.queryClient.infiniteQuery(membersOptions(deps));
  },
  loaderDeps: ({ search }: Readonly<{ search: RawSearch }>) => normalizeUsersSearch(search),
  pendingComponent: UsersPending,
  validateSearch: normalizeUsersSearch,
});

export { Route };
