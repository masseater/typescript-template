import { createFileRoute, defaultStringifySearch, redirect } from "@tanstack/react-router";

import {
  GroupMissing,
  GroupsFailed,
  GroupsPending,
  InvalidGroupSearch,
  loadGroup,
  normalizeGroupSearch,
} from "#pages/messages/index.ts";
import { GroupRoute } from "./-group-route.tsx";

import type { GroupSearch } from "#pages/messages/index.ts";

type GroupParams = Readonly<{ id: string }>;

function requireGroupSearch(raw: unknown): GroupSearch {
  try {
    return normalizeGroupSearch(raw);
  } catch (error) {
    if (error instanceof InvalidGroupSearch) {
      throw redirect({ replace: true, search: {}, to: "/groups" });
    }
    throw error;
  }
}

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/_member/groups/$id")({
  validateSearch: requireGroupSearch,
  loaderDeps: ({ search }: Readonly<{ search: GroupSearch }>) => ({
    invite: search.invite,
  }),
  beforeLoad: ({
    location,
    params,
    search,
  }: Readonly<{
    location: Readonly<{ searchStr: string }>;
    params: GroupParams;
    search: GroupSearch;
  }>) => {
    if (location.searchStr !== defaultStringifySearch(search)) {
      throw redirect({ params, replace: true, search, to: "/groups/$id" });
    }
  },
  loader: async ({
    deps,
    params,
  }: Readonly<{ deps: Readonly<{ invite: string | undefined }>; params: GroupParams }>) =>
    loadGroup(params.id, deps.invite),
  component: GroupRoute,
  errorComponent: GroupsFailed,
  notFoundComponent: GroupMissing,
  pendingComponent: GroupsPending,
});

export { Route };
