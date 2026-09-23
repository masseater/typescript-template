import { previewInvitation } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { InvitePending, InviteRoute } from "#pages/invite/index.ts";

const Route = createFileRoute("/invite/$token")({
  loader: ({ params }) => previewInvitation("/api/invite", params.token),
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  pendingComponent: InvitePending,
  component: InviteRoute,
});

export { Route };
