import { getRouteApi } from "@tanstack/react-router";

import { ConversationPage } from "#pages/messages/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/messages/$id");

function ConversationRoute(): ReactElement {
  return <ConversationPage thread={route.useLoaderData()} search={route.useSearch()} />;
}

export { ConversationRoute };
