import type { ReactElement } from "react";
import { UsersPage } from "#pages/users/index.ts";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  return <UsersPage list={route.useLoaderData()} search={route.useSearch()} />;
}

export { UsersRoute };
