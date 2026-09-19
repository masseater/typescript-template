import { getRouteApi } from "@tanstack/react-router";

import { UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  const search = normalizeUsersSearch(route.useSearch());
  return <UsersPage list={route.useLoaderData()} search={search} />;
}

export { UsersRoute };
