import { getRouteApi } from "@tanstack/react-router";

import { UsersPage } from "./users-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  return <UsersPage list={route.useLoaderData()} search={route.useSearch()} />;
}

export { UsersRoute };
