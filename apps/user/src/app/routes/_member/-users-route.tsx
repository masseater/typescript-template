import { getRouteApi } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { UsersPage, normalizeUsersSearch } from "#pages/users/index.ts";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  const search = normalizeUsersSearch(route.useSearch());
  return <UsersPage list={route.useLoaderData()} search={search} />;
}

export { UsersRoute };
