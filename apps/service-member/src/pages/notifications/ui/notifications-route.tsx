import { getRouteApi } from "@tanstack/react-router";

import { NotificationsPage } from "./notifications-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/notifications");

function NotificationsRoute(): ReactElement {
  const { items } = route.useLoaderData();
  return <NotificationsPage initialItems={items} />;
}

export { NotificationsRoute };
