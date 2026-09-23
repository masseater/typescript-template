import { ROLE } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InquiriesView } from "./inquiries-view.tsx";

import type { InquiryLookup } from "#pages/inquiries/model/inquiry-lookup-state.ts";

const openedAt = DateTime.toDate(DateTime.makeUnsafe("2026-04-01T09:00:00Z"));

const summary = {
  createdAt: openedAt,
  id: "inquiry-1",
  memberId: "member-1",
  status: "open",
  subject: "ログインできません",
  updatedAt: openedAt,
};

const idle: InquiryLookup = {
  counts: undefined,
  error: undefined,
  handleInquiryLookup: () => undefined,
  handleLookupIdChange: () => undefined,
  handleMemberIdChange: () => undefined,
  handleMemberLookup: () => undefined,
  lookupId: "",
  memberId: "",
  memberInquiries: undefined,
  selected: undefined,
  showInquiry: () => undefined,
};

function rendered(lookup: Partial<InquiryLookup>): string {
  return renderedAt(<InquiriesView lookup={{ ...idle, ...lookup }} />, ["/"]);
}

describe("inquiry lookup", () => {
  it("says it is loading until the counts arrive", () => {
    expect.hasAssertions();
    const html = rendered({});
    expect(html).toContain("読み込み中です。");
    expect(html).toContain("会員の問い合わせを表示");
    expect(html).not.toContain('aria-label="会員の問い合わせ一覧"');
  });

  it("shows the counts and the failure", () => {
    expect.hasAssertions();
    const html = rendered({
      counts: { byStatus: { answered: 2, closed: 3, open: 1 }, trend: [] },
      error: "問い合わせを取得できませんでした。",
    });
    expect(html).toContain('aria-label="件数"');
    expect(html).toContain(
      '<p class="text-sm text-destructive">問い合わせを取得できませんでした。</p>',
    );
    expect(html).not.toContain("読み込み中です。");
  });

  it("says the member has no inquiries", () => {
    expect.hasAssertions();
    expect(rendered({ memberInquiries: [] })).toContain("問い合わせはありません。");
  });

  it("lists the member's inquiries and the selected thread", () => {
    expect.hasAssertions();
    const html = rendered({
      memberInquiries: [summary],
      selected: {
        ...summary,
        messages: [
          {
            authorId: "admin-1",
            authorKind: ROLE.administrator,
            body: "確認します。",
            createdAt: openedAt,
            id: "message-1",
          },
        ],
      },
    });
    expect(html).toContain('<p class="font-medium">ログインできません</p>');
    expect(html).toContain('aria-label="問い合わせの詳細"');
    expect(html).toContain('<p class="text-sm font-medium">運営</p>');
    expect(html).toContain("確認します。");
  });
});
