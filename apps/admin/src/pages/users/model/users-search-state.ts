import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { isEqual } from "es-toolkit";
import { useEffect } from "react";

import { normalizeUsersSearch } from "./users-search.ts";

import type { UsersSearch } from "./users-search.ts";

const route = getRouteApi("/_admin/members");

function useUsersSearch(): UsersSearch {
  const raw: unknown = route.useSearch();
  const search = normalizeUsersSearch(raw);
  const navigate = useNavigate({ from: "/members" });
  useEffect(() => {
    if (!isEqual(raw, search)) {
      void navigate({ replace: true, search });
    }
  }, [navigate, raw, search]);
  return search;
}

export { useUsersSearch };
