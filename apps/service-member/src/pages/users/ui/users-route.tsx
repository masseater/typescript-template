import { getRouteApi } from "@tanstack/react-router";

import { UsersPage } from "./users-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/search");

function SearchRoute(): ReactElement {
  return <UsersPage search={route.useSearch()} />;
}

export { SearchRoute };
