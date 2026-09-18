import { UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  return <UsersPage search={normalizeUsersSearch(route.useSearch())} />;
}

export { UsersRoute };
