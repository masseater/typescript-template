import { INQUIRY_AUTHOR_KIND, INQUIRY_STATUS } from "@repo/config";
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
  status: INQUIRY_STATUS.open,
  subject: "ログインできません",
  updatedAt: openedAt,
} as const;

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

const answered = {
  memberInquiries: [summary],
  selected: {
    ...summary,
    messages: [
      {
        authorId: "admin-1",
        authorKind: INQUIRY_AUTHOR_KIND.admin,
        body: "確認します。",
        createdAt: openedAt,
        id: "message-1",
      },
    ],
  },
} as const satisfies Partial<InquiryLookup>;

const failed = {
  counts: {
    byStatus: {
      [INQUIRY_STATUS.answered]: 2,
      [INQUIRY_STATUS.closed]: 3,
      [INQUIRY_STATUS.open]: 1,
    },
    trend: [],
  },
  error: "問い合わせを取得できませんでした。",
} as const satisfies Partial<InquiryLookup>;

function rendered(lookup: Partial<InquiryLookup>): string {
  return renderedAt(<InquiriesView lookup={{ ...idle, ...lookup }} />, ["/"]);
}

describe("inquiry lookup", () => {
  it("says it is loading until the counts arrive", () => {
    expect(rendered({})).toContain("読み込み中です。");
  });

  it("offers the member lookup before anything is loaded", () => {
    expect(rendered({})).toContain("会員の問い合わせを表示");
  });

  it("shows no member list before a lookup", () => {
    expect(rendered({})).not.toContain('aria-label="会員の問い合わせ一覧"');
  });

  it("shows the counts", () => {
    expect(rendered(failed)).toContain('aria-label="件数"');
  });

  it("shows the failure", () => {
    expect(rendered(failed)).toContain(
      '<p class="text-sm text-destructive">問い合わせを取得できませんでした。</p>',
    );
  });

  it("drops the loading notice once the counts arrived", () => {
    expect(rendered(failed)).not.toContain("読み込み中です。");
  });

  it("says the member has no inquiries", () => {
    expect(rendered({ memberInquiries: [] })).toContain("問い合わせはありません。");
  });

  it("lists the member's inquiries", () => {
    expect(rendered(answered)).toContain('<p class="font-medium">ログインできません</p>');
  });

  it("shows the selected thread", () => {
    expect(rendered(answered)).toContain('aria-label="問い合わせの詳細"');
  });

  it("labels a staff message as from the operator", () => {
    expect(rendered(answered)).toContain('<p class="text-sm font-medium">運営</p>');
  });
});
