import { previewInvitation } from "@repo/auth-ui";
import { STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { InvitePage } from "#pages/invite/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/invite/$token")({
  loader: async ({ params }) => previewInvitation("/api/invite", params.token),
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  pendingComponent: InvitePending,
  component: InviteRoute,
});

function InvitePending(): ReactElement {
  return <StatusMessage variant={STATUS_VARIANT.pending}>招待を確認しています。</StatusMessage>;
}

function InviteRoute(): ReactElement {
  const { token } = Route.useParams();
  const invitation = Route.useLoaderData();
  return <InvitePage token={token} invitation={invitation} />;
}

export { Route };
