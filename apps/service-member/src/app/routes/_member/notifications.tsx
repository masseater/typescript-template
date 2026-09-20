import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage, loadNotificationsPage } from "#pages/notifications/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/notifications")({
  component: NotificationsRoute,
  loader: async () => ({ items: await loadNotificationsPage() }),
});

function NotificationsRoute(): ReactElement {
  const { items } = Route.useLoaderData();
  return <NotificationsPage initialItems={items} />;
}

export { Route };
