import { getRouteApi } from "@tanstack/react-router";

import { UsersPage } from "#pages/users/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/");

function UsersRoute(): ReactElement {
  return <UsersPage search={route.useSearch()} />;
}

export { UsersRoute };
