import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  GroupFailed,
  GroupMissing,
  GroupPending,
  InvalidGroupsSearch,
  loadGroup,
  normalizeGroupsSearch,
} from "#pages/groups/index.ts";
import { GroupRoute } from "./-group-route.tsx";

import type { GroupsSearch } from "#pages/groups/index.ts";

type GroupParams = Readonly<{ id: string }>;

function requireGroupsSearch(raw: unknown): GroupsSearch {
  try {
    return normalizeGroupsSearch(raw);
  } catch (error) {
    if (error instanceof InvalidGroupsSearch) {
      throw redirect({ replace: true, search: {}, to: "/home" });
    }
    throw error;
  }
}

const Route = createFileRoute("/_member/groups/$id")({
  validateSearch: requireGroupsSearch,
  loaderDeps: ({ search }: Readonly<{ search: GroupsSearch }>) => search,
  beforeLoad: ({
    location,
    params,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    params: GroupParams;
    search: GroupsSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ params, replace: true, search, to: "/groups/$id" });
    }
  },
  loader: async ({ deps, params }: Readonly<{ deps: GroupsSearch; params: GroupParams }>) =>
    loadGroup(params.id, deps.invite),
  component: GroupRoute,
  errorComponent: GroupFailed,
  notFoundComponent: GroupMissing,
  pendingComponent: GroupPending,
});

export { Route };
