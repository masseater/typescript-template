import { getRouteApi } from "@tanstack/react-router";

import { ComposePage } from "./compose-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/messages/new");

function ComposeRoute(): ReactElement {
  const member = route.useLoaderData();
  return <ComposePage peerId={member.id} peerName={member.name} />;
}

export { ComposeRoute };
