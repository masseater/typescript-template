import { getRouteApi } from "@tanstack/react-router";

import { GroupPage } from "#pages/groups/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/groups/$id");

function GroupRoute(): ReactElement {
  return <GroupPage group={route.useLoaderData()} search={route.useSearch()} />;
}

export { GroupRoute };
