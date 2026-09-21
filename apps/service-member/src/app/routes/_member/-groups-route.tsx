import { getRouteApi } from "@tanstack/react-router";

import { OpenGroupsPage } from "#pages/messages/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/groups/");

function GroupsRoute(): ReactElement {
  return <OpenGroupsPage list={route.useLoaderData()} />;
}

export { GroupsRoute };
