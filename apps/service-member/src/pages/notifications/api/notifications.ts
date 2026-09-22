import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { FollowMember, NotificationList } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type NotificationItem = (typeof NotificationList.Type)["items"][number];

function loadNotifications(): Promise<readonly NotificationItem[]> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.get().then((response: ApiReply) => apiData(NotificationList, response).items),
  );
}

function markNotificationRead(id: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications.read.post({ id }).then((response: ApiReply) => {
      apiData(FollowMember, response);
    }),
  );
}

function markAllNotificationsRead(): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.notifications["read-all"].post({}).then((response: ApiReply) => {
      apiData(FollowMember, response);
    }),
  );
}

export { loadNotifications, markAllNotificationsRead, markNotificationRead };
