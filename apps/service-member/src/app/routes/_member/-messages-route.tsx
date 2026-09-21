import { getRouteApi } from "@tanstack/react-router";

import { MessagesPage } from "#pages/messages/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/messages/");

function MessagesRoute(): ReactElement {
  return <MessagesPage list={route.useLoaderData()} search={route.useSearch()} />;
}

export { MessagesRoute };
