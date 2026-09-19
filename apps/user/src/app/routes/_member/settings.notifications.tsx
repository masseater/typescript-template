import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/notifications")({
  component: NotificationsPage,
});

export { Route };
