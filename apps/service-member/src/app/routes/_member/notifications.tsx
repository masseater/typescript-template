import { createFileRoute } from "@tanstack/react-router";

import { NotificationsRoute, loadNotifications } from "#pages/notifications/index.ts";

const Route = createFileRoute("/_member/notifications")({
  component: NotificationsRoute,
  loader: () => loadNotifications().then((items) => ({ items })),
});

export { Route };
