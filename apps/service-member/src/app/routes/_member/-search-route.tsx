import { getRouteApi } from "@tanstack/react-router";

import { UsersPage } from "#pages/users/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/search");

function SearchRoute(): ReactElement {
  return <UsersPage list={route.useLoaderData()} search={route.useSearch()} />;
}

export { SearchRoute };
