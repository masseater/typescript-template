import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage, loadNotifications } from "#pages/notifications/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/notifications")({
  component: NotificationsRoute,
  loader: () => loadNotifications().then((items) => ({ items })),
});

function NotificationsRoute(): ReactElement {
  const { items } = Route.useLoaderData();
  return <NotificationsPage initialItems={items} />;
}

export { Route };
