import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { FollowMember, NotificationList } from "#shared/contracts/index.ts";

import type { NotificationItem } from "#shared/contracts/index.ts";

async function loadNotifications(): Promise<readonly NotificationItem[]> {
  const { api } = await userClient();
  return apiData(NotificationList, await api.notifications.get()).items;
}

async function markNotificationRead(id: string): Promise<void> {
  const { api } = await userClient();
  apiData(FollowMember, await api.notifications.read.post({ id }));
}

async function markAllNotificationsRead(): Promise<void> {
  const { api } = await userClient();
  apiData(FollowMember, await api.notifications["read-all"].post({}));
}

export { loadNotifications, markAllNotificationsRead, markNotificationRead };
