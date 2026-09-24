import { useAction } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "#pages/notifications/api/notifications.ts";
import { NotificationsView } from "./notifications-view.tsx";

import type { NotificationEntry } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function NotificationsPage({
  initialItems,
}: Readonly<{
  initialItems: readonly NotificationEntry[];
}>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const readAllAction = useAction();
  const openAction = useAction();
  const readAll = (): void => {
    readAllAction.run(() =>
      markAllNotificationsRead().then(() => router.invalidate().then(() => undefined)),
    );
  };
  const openItem = (item: NotificationEntry): void => {
    openAction.run(() => {
      const mark = item.read
        ? Promise.resolve()
        : markNotificationRead(item.id).then(() => router.invalidate().then(() => undefined));
      return mark.then(() => navigate({ href: item.href }).then(() => undefined));
    });
  };
  return (
    <NotificationsView
      error={readAllAction.error ?? openAction.error}
      items={initialItems}
      onOpen={openItem}
      onReadAll={readAll}
      openBlocked={openAction.blocked}
      readAllBlocked={readAllAction.blocked}
    />
  );
}

export { NotificationsPage };
