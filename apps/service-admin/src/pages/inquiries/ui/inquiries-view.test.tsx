import { INQUIRY_STATUS } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InquiriesView } from "./inquiries-view.tsx";

import type { AdminInquirySummary } from "#pages/inquiries/model/inquiry.ts";
import type { InquiryStatus } from "#pages/inquiries/model/status-label.ts";

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
    expect.hasAssertions();
    const html = rendered({});
    expect(html).toContain("読み込み中です。");
    expect(html).not.toContain("対応待ち");
  });

  it("presses the selected status filter", () => {
    expect.hasAssertions();
    const html = rendered({ status: INQUIRY_STATUS.open });
    expect(html).toContain(
      '<button type="button" aria-pressed="true" class="rounded-md border px-3 py-1 text-sm border-primary bg-primary text-primary-foreground">受付</button>',
    );
    expect(html).toContain(
      'aria-pressed="false" class="rounded-md border px-3 py-1 text-sm border-border">完了</button>',
    );
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered({ error: "問い合わせを取得できませんでした。" });
    expect(html).toContain(
      '<p class="text-sm text-destructive">問い合わせを取得できませんでした。</p>',
    );
    expect(html).not.toContain("読み込み中です。");
  });

  it("says nothing matches for an empty list", () => {
    expect.hasAssertions();
    const html = rendered({ inquiries: [], pendingCount: 0 });
    expect(html).toContain("条件に一致する問い合わせはありません。");
    expect(html).toContain("対応待ち: 0 件");
    expect(html).not.toContain('aria-label="問い合わせの一覧"');
  });

  it("links each inquiry to its thread", () => {
    expect.hasAssertions();
    const html = rendered({ inquiries: [inquiry], pendingCount: 1 });
    expect(html).toContain('aria-label="問い合わせの一覧"');
    expect(html).toContain('href="/inquiries/inquiry-1"');
    expect(html).toContain('<td class="p-2">山田</td>');
  });
});
