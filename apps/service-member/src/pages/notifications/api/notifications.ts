import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import {
  FollowMember,
  NotificationList,
  NotificationPreferences,
} from "#shared/contracts/index.ts";

import type {
  NotificationItem,
  NotificationPreferences as Preferences,
} from "#shared/contracts/index.ts";

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

async function loadNotificationPreferences(): Promise<Preferences> {
  const { api } = await userClient();
  return apiData(NotificationPreferences, await api.notifications.preferences.get());
}

async function saveNotificationPreferences(preferences: Preferences): Promise<Preferences> {
  const { api } = await userClient();
  return apiData(NotificationPreferences, await api.notifications.preferences.patch(preferences));
}

export {
  loadNotificationPreferences,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
};
