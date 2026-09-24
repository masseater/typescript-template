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
  it("keeps the typed filter while loading", () => {
    expect(rendered(undefined, undefined)).toContain('value="staff-1"');
  });

  it("says it is loading until the page arrives", () => {
    expect(rendered(undefined, undefined)).toContain("読み込み中です。");
  });

  it("shows the failure", () => {
    expect(rendered("監査ログを取得できませんでした。", undefined)).toContain(
      "監査ログを取得できませんでした。",
    );
  });

  it("drops the loading notice once the load failed", () => {
    expect(rendered("失敗", undefined)).not.toContain("読み込み中です。");
  });

  it("says there is no log yet for an empty page", () => {
    expect(rendered(undefined, { events: [], total: 0 })).toContain("監査ログはまだありません。");
  });

  it("hides the list for an empty page", () => {
    expect(rendered(undefined, { events: [], total: 0 })).not.toContain(
      'aria-label="監査ログ一覧"',
    );
  });

  it("shows the total", () => {
    expect(rendered(undefined, auditPage)).toContain(
      '<p class="text-sm text-muted-foreground">全 1 件</p>',
    );
  });

  it("lists each event target", () => {
    expect(rendered(undefined, auditPage)).toContain('<td class="p-2">member-board</td>');
  });
});
