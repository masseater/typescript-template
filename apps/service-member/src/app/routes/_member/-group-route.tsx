import { getRouteApi } from "@tanstack/react-router";

import { GroupPage } from "#pages/messages/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/groups/$id");

function GroupRoute(): ReactElement {
  const group = route.useLoaderData();
  const search = route.useSearch();
  return <GroupPage group={group} invite={search.invite} />;
}

export { GroupRoute };
