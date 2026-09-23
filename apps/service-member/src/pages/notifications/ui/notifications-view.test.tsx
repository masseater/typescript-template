import { notificationKinds } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { NotificationsView } from "./notifications-view.tsx";

import type { NotificationItem } from "./notifications-view.tsx";

const [kind] = notificationKinds;

const unread = {
  createdAt: Date.parse("2026-04-02T09:00:00Z"),
  href: "/messages/conversation-1",
  id: "notification-1",
  kind,
  label: "新しいメッセージがあります",
  read: false,
} as const satisfies NotificationItem;

function rendered(
  items: readonly NotificationItem[],
  error: string | undefined = undefined,
): string {
  return renderedAt(
    <NotificationsView
      error={error}
      items={items}
      onOpen={() => undefined}
      onReadAll={() => undefined}
      openBlocked={false}
      readAllBlocked={false}
    />,
    ["/notifications"],
  );
}

describe("notifications view", () => {
  it("says there are no notifications and has nothing to mark read", () => {
    expect.hasAssertions();
    const html = rendered([]);
    expect(html).toContain("通知はまだありません。");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>すべて既読にする/u);
  });

  it("highlights an unread notification and offers to mark all read", () => {
    expect.hasAssertions();
    const html = rendered([unread]);
    expect(html).toContain(unread.label);
    expect(html).toContain("border-primary");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>すべて既読にする/u);
    expect(html).not.toContain("通知はまだありません。");
  });

  it("dims a read notification and shows a failure", () => {
    expect.hasAssertions();
    const html = rendered([{ ...unread, read: true }], "既読にできませんでした。");
    expect(html).not.toContain("border-primary");
    expect(html).toContain("既読にできませんでした。");
  });
});
