import { getRouteApi, useNavigate } from "@tanstack/react-router";
import type { UsersSearch } from "./users-search.ts";
import { isEqual } from "es-toolkit";
import { normalizeUsersSearch } from "./users-search.ts";
import { useEffect } from "react";

const route = getRouteApi("/_admin/");

function useUsersSearch(): UsersSearch {
  const raw: unknown = route.useSearch();
  const search = normalizeUsersSearch(raw);
  const navigate = useNavigate({ from: "/" });
  useEffect(() => {
    if (!isEqual(raw, search)) {
      void navigate({ replace: true, search });
    }
  }, [navigate, raw, search]);
  return search;
}

export { useUsersSearch };
