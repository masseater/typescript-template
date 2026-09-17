import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import type { UsersSearch } from "#users-search.ts";
import { isEqual } from "es-toolkit";
import { normalizeUsersSearch } from "#users-search.ts";

const route = getRouteApi("/_admin/");

function useUsersSearch(): UsersSearch {
  const raw: unknown = route.useSearch();
  const search = useMemo(() => normalizeUsersSearch(raw), [raw]);
  const navigate = useNavigate({ from: "/" });
  useEffect(() => {
    if (!isEqual(raw, search)) {
      void navigate({ replace: true, search });
    }
  }, [navigate, raw, search]);
  return search;
}

export { useUsersSearch };
