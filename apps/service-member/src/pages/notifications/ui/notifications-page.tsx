import { Button, Heading, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "#pages/notifications/api/notifications.ts";

import type { NotificationItem } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function NotificationsPage({
  initialItems,
}: Readonly<{ initialItems: readonly NotificationItem[] }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const readAllAction = useAction();
  const openAction = useAction();

  const readAll = (): void => {
    readAllAction.run(async () => {
      await markAllNotificationsRead();
      await router.invalidate();
    });
  };

  const openItem = (item: NotificationItem): void => {
    openAction.run(async () => {
      if (!item.read) {
        await markNotificationRead(item.id);
        await router.invalidate();
      }
      await navigate({ href: item.href });
    });
  };

  const items = initialItems;
  const error = readAllAction.error ?? openAction.error;

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Heading as="h1" size="page">
          通知
        </Heading>
        <Button
          disabled={readAllAction.blocked || items.every((item) => item.read)}
          onClick={readAll}
          type="button"
          variant="secondary"
        >
          すべて既読にする
        </Button>
      </div>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {items.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.pending}>通知はまだありません。</StatusMessage>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={`block w-full rounded-lg border p-3 text-left ${item.read ? "border-border" : "border-primary bg-muted/40"}`}
                disabled={openAction.blocked}
                onClick={() => openItem(item)}
                type="button"
              >
                <p className="text-sm leading-normal">{item.label}</p>
                <p className="text-xs leading-normal text-muted-foreground">
                  {updatedAtLabel.format(new Date(item.createdAt))}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function loadNotificationsPage(): Promise<readonly NotificationItem[]> {
  return loadNotifications();
}

export { NotificationsPage, loadNotificationsPage };
