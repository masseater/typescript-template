import { Button, Heading, STATUS_VARIANT, StatusMessage, formatWarekiDateTime } from "@repo/ui";

import type { NotificationList } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

type NotificationItem = (typeof NotificationList.Type)["items"][number];

function NotificationRow({
  disabled,
  item,
  onOpen,
}: Readonly<{
  disabled: boolean;
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}>): ReactElement {
  return (
    <li>
      <button
        className={`block w-full rounded-lg border p-3 text-left ${item.read ? "border-border" : "border-primary bg-muted/40"}`}
        disabled={disabled}
        onClick={() => onOpen(item)}
        type="button"
      >
        <p className="text-sm leading-normal">{item.label}</p>
        <p className="text-xs leading-normal text-muted-foreground">
          {formatWarekiDateTime(item.createdAt)}
        </p>
      </button>
    </li>
  );
}

function NotificationsView({
  error,
  items,
  onOpen,
  onReadAll,
  openBlocked,
  readAllBlocked,
}: Readonly<{
  error: string | undefined;
  items: readonly NotificationItem[];
  onOpen: (item: NotificationItem) => void;
  onReadAll: () => void;
  openBlocked: boolean;
  readAllBlocked: boolean;
}>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Heading as="h1" size="page">
          通知
        </Heading>
        <Button
          disabled={readAllBlocked || items.every((item) => item.read)}
          onClick={onReadAll}
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
            <NotificationRow key={item.id} disabled={openBlocked} item={item} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </main>
  );
}

export { NotificationsView };
export type { NotificationItem };
