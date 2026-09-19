import { getRouteApi } from "@tanstack/react-router";

import type { UsersSearch } from "./users-search.ts";

const route = getRouteApi("/_admin/members");

function useUsersSearch(): UsersSearch {
  return route.useSearch();
}

export { useUsersSearch };
