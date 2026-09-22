import { previewInvitation } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import { InvitePending, InviteRoute } from "#pages/invite/index.ts";

const Route = createFileRoute("/_public/invite/$token")({
  loader: ({ params }) => previewInvitation("/api/invite", params.token),
  pendingComponent: InvitePending,
  component: InviteRoute,
});

export { Route };
