import { getRouteApi } from "@tanstack/react-router";

import { ThreadPage } from "#pages/board/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/board/$id");

function ThreadRoute(): ReactElement {
  return <ThreadPage thread={route.useLoaderData()} search={route.useSearch()} />;
}

export { ThreadRoute };
