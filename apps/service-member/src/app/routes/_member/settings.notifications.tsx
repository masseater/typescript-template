import { createFileRoute } from "@tanstack/react-router";

import {
  SettingsNotificationsRoute,
  loadNotificationPreferences,
} from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/notifications")({
  component: SettingsNotificationsRoute,
  loader: () => loadNotificationPreferences().then((preferences) => ({ preferences })),
});

export { Route };
