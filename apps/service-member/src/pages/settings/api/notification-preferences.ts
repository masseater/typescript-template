import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { NotificationPreferences } from "#shared/contracts/index.ts";

import type { NotificationPreferences as Preferences } from "#shared/contracts/index.ts";

async function loadNotificationPreferences(): Promise<Preferences> {
  const { api } = await userClient();
  return apiData(NotificationPreferences, await api.notifications.preferences.get());
}

async function saveNotificationPreferences(preferences: Preferences): Promise<Preferences> {
  const { api } = await userClient();
  return apiData(NotificationPreferences, await api.notifications.preferences.patch(preferences));
}

export { loadNotificationPreferences, saveNotificationPreferences };
