import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { isEqual } from "es-toolkit";
import { useEffect } from "react";

import { normalizeUsersSearch, type UsersSearch } from "./users-search.ts";

const route = getRouteApi("/_admin/");

const useUsersSearch = (): UsersSearch => {
  const raw: unknown = route.useSearch();
  const search = normalizeUsersSearch(raw);
  const navigate = useNavigate({ from: "/" });
  useEffect(() => {
    if (!isEqual(raw, search)) {
      void navigate({ replace: true, search });
    }
  }, [navigate, raw, search]);
  return search;
};

export { useUsersSearch };
