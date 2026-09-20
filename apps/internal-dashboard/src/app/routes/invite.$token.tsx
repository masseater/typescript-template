import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { InvitePage } from "#pages/invite/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/invite/$token")({
  component: InviteRoute,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

function InviteRoute(): ReactElement {
  const { token } = Route.useParams();
  return <InvitePage token={token} />;
}

export { Route };
