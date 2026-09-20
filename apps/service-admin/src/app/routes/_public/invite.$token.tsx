import { createFileRoute } from "@tanstack/react-router";

import { InvitePage } from "#pages/invite/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_public/invite/$token")({ component: InviteRoute });

function InviteRoute(): ReactElement {
  const { token } = Route.useParams();
  return <InvitePage token={token} />;
}

export { Route };
