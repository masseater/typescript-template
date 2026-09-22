import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { NotificationPreferences } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type Preferences = typeof NotificationPreferences.Type;

function loadNotificationPreferences(): Promise<Preferences> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.preferences
      .get()
      .then((response: ApiReply) => apiData(NotificationPreferences, response)),
  );
}

function saveNotificationPreferences(preferences: Preferences): Promise<Preferences> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.preferences
      .patch(preferences)
      .then((response: ApiReply) => apiData(NotificationPreferences, response)),
  );
}

export { loadNotificationPreferences, saveNotificationPreferences };
export type { Preferences as NotificationPreferences };
