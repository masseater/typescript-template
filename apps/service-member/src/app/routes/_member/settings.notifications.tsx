import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage, loadSettingsNotificationsPage } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/notifications")({
  component: SettingsNotificationsRoute,
  loader: async () => ({ preferences: await loadSettingsNotificationsPage() }),
});

function SettingsNotificationsRoute(): ReactElement {
  const { preferences } = Route.useLoaderData();
  return <NotificationsPage initial={preferences} />;
}

export { Route };
