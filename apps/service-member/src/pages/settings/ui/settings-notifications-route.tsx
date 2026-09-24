import { getRouteApi } from "@tanstack/react-router";

import { NotificationsPage } from "./notifications-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/notifications");

function SettingsNotificationsRoute(): ReactElement {
  const { preferences } = route.useLoaderData();
  return <NotificationsPage initial={preferences} />;
}

export { SettingsNotificationsRoute };
