import { AUDIT_ACTION } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AuditView } from "./audit-view.tsx";

import type { AuditFilterForm } from "#pages/audit/model/audit-filter.ts";
import type { StaffAuditPageView } from "#shared/contracts/index.ts";

const filter: AuditFilterForm = {
  action: "",
  actorId: "staff-1",
  handleActionChange: () => undefined,
  handleActorIdChange: () => undefined,
  handleSubmit: () => undefined,
  handleTargetIdChange: () => undefined,
  targetId: "",
};

const auditPage = {
  events: [
    {
      action: AUDIT_ACTION.flagToggled,
      actorId: "staff-1",
      createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-04-01T09:00:00Z")),
      id: "event-1",
      targetId: "member-board",
    },
  ],
  total: 1,
} as const satisfies StaffAuditPageView;

function rendered(error: string | undefined, page: StaffAuditPageView | undefined): string {
  return renderedAt(<AuditView audit={filter} error={error} page={page} />, ["/"]);
}

describe("audit log", () => {
  it("keeps the filter and says it is loading until the page arrives", () => {
    expect.hasAssertions();
    const html = rendered(undefined, undefined);
    expect(html).toContain("操作者 ID");
    expect(html).toContain('value="staff-1"');
    expect(html).toContain("読み込み中です。");
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered("監査ログを取得できませんでした。", undefined);
    expect(html).toContain("監査ログを取得できませんでした。");
    expect(html).not.toContain("読み込み中です。");
  });

  it("says there is no log yet for an empty page", () => {
    expect.hasAssertions();
    const html = rendered(undefined, { events: [], total: 0 });
    expect(html).toContain("監査ログはまだありません。");
    expect(html).not.toContain('aria-label="監査ログ一覧"');
  });

  it("lists each event with the total", () => {
    expect.hasAssertions();
    const html = rendered(undefined, auditPage);
    expect(html).toContain('<p class="text-sm text-muted-foreground">全 1 件</p>');
    expect(html).toContain(`<td class="p-2">${AUDIT_ACTION.flagToggled}</td>`);
    expect(html).toContain('<td class="p-2">member-board</td>');
  });
});
