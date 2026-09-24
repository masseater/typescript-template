import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { FollowMember, NotificationList } from "#shared/contracts/index.ts";

import type { NotificationEntry } from "#shared/contracts/index.ts";

function loadNotifications(): Promise<readonly NotificationEntry[]> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.get().then((response) => apiData(NotificationList, response).items),
  );
}

function markNotificationRead(id: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.read.post({ id }).then((response) => {
      apiData(FollowMember, response);
    }),
  );
}

function markAllNotificationsRead(): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications["read-all"].post({}).then((response) => {
      apiData(FollowMember, response);
    }),
  );
}

export { loadNotifications, markAllNotificationsRead, markNotificationRead };
