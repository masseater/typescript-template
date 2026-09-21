import { getRouteApi } from "@tanstack/react-router";

import { MessagesPage } from "#pages/messages/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/messages/");

function MessagesRoute(): ReactElement {
  const loaded = route.useLoaderData();
  return (
    <MessagesPage
      composePeer={"composePeer" in loaded ? loaded.composePeer : undefined}
      list={loaded.list}
      search={route.useSearch()}
    />
  );
}

export { MessagesRoute };
