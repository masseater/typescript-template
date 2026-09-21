import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage, loadNotificationPreferences } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/notifications")({
  component: SettingsNotificationsRoute,
  loader: async () => ({ preferences: await loadNotificationPreferences() }),
});

function SettingsNotificationsRoute(): ReactElement {
  const { preferences } = Route.useLoaderData();
  return <NotificationsPage initial={preferences} />;
}

export { Route };
