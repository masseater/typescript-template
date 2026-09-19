import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "#pages/notifications/index.ts";

const Route = createFileRoute("/_member/notifications")({
  component: NotificationsPage,
});

export { Route };
