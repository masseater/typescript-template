import { INQUIRY_STATUS, type InquiryStatus } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InquiriesView } from "./inquiries-view.tsx";

import type { AdminInquirySummary } from "#pages/inquiries/model/inquiry.ts";

const updatedAt = DateTime.toDate(DateTime.makeUnsafe("2026-04-01T09:00:00Z"));

const inquiry = {
  createdAt: updatedAt,
  id: "inquiry-1",
  memberId: "member-1",
  memberName: "山田",
  status: INQUIRY_STATUS.open,
  subject: "ログインできません",
  updatedAt,
} as const satisfies AdminInquirySummary;

function rendered(
  state: Readonly<{
    error?: string;
    inquiries?: readonly AdminInquirySummary[];
    pendingCount?: number;
    status?: InquiryStatus;
  }>,
): string {
  return renderedAt(
    <InquiriesView
      error={state.error}
      inquiries={state.inquiries}
      onToggle={() => undefined}
      pendingCount={state.pendingCount}
      status={state.status}
    />,
    ["/inquiries", "/inquiries/$id"],
  );
}

describe("inquiry list", () => {
  it("says it is loading until the inquiries arrive", () => {
    expect(rendered({})).toContain("読み込み中です。");
  });

  it("hides the pending count until it arrives", () => {
    expect(rendered({})).not.toContain("対応待ち");
  });

  it("presses the selected status filter", () => {
    expect(rendered({ status: INQUIRY_STATUS.open })).toContain(
      '<button type="button" aria-pressed="true" class="rounded-md border px-3 py-1 text-sm border-primary bg-primary text-primary-foreground">受付</button>',
    );
  });

  it("leaves the other status filters unpressed", () => {
    expect(rendered({ status: INQUIRY_STATUS.open })).toContain(
      'aria-pressed="false" class="rounded-md border px-3 py-1 text-sm border-border">完了</button>',
    );
  });

  it("shows the failure", () => {
    expect(rendered({ error: "問い合わせを取得できませんでした。" })).toContain(
      '<p class="text-sm text-destructive">問い合わせを取得できませんでした。</p>',
    );
  });

  it("drops the loading notice once the load failed", () => {
    expect(rendered({ error: "失敗" })).not.toContain("読み込み中です。");
  });

  it("says nothing matches for an empty list", () => {
    expect(rendered({ inquiries: [], pendingCount: 0 })).toContain(
      "条件に一致する問い合わせはありません。",
    );
  });

  it("shows the pending count", () => {
    expect(rendered({ inquiries: [], pendingCount: 0 })).toContain("対応待ち: 0 件");
  });

  it("links each inquiry to its thread", () => {
    expect(rendered({ inquiries: [inquiry], pendingCount: 1 })).toContain(
      'href="/inquiries/inquiry-1"',
    );
  });

  it("names the member who asked", () => {
    expect(rendered({ inquiries: [inquiry], pendingCount: 1 })).toContain(
      '<td class="p-2">山田</td>',
    );
  });
});
