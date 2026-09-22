import { getRouteApi } from "@tanstack/react-router";

import { GroupPage } from "./group-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/groups/$id");

function GroupRoute(): ReactElement {
  return <GroupPage group={route.useLoaderData()} search={route.useSearch()} />;
}

export { GroupRoute };
