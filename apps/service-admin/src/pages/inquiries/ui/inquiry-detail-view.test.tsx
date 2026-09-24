import { INQUIRY_STATUS, ROLE } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InquiryDetailView, MemberSummaryView } from "./inquiry-detail-view.tsx";

import type { AdminInquiryDetail, AdminInquirySummary } from "#pages/inquiries/model/inquiry.ts";
import type { InquiryStatus } from "#pages/inquiries/model/status-label.ts";

const sentAt = DateTime.toDate(DateTime.makeUnsafe("2026-04-01T09:00:00Z"));

const summary = {
  createdAt: sentAt,
  id: "inquiry-1",
  memberId: "member-1",
  memberName: "山田",
  status: INQUIRY_STATUS.open,
  subject: "ログインできません",
  updatedAt: sentAt,
} as const satisfies AdminInquirySummary;

function thread(status: InquiryStatus): AdminInquiryDetail {
  return {
    ...summary,
    messages: [
      {
        authorId: "admin-1",
        authorKind: ROLE.administrator,
        body: "確認します。",
        createdAt: sentAt,
        id: "m-1",
      },
      {
        authorId: "member-1",
        authorKind: ROLE.member,
        body: "お願いします。",
        createdAt: sentAt,
        id: "m-2",
      },
    ],
    status,
  };
}

const paths = ["/inquiries", "/inquiries/$id", "/members/$id"] as const;

function rendered(
  error: string | undefined,
  inquiry: AdminInquiryDetail | undefined,
  inquiries: readonly AdminInquirySummary[] | undefined,
): string {
  return renderedAt(
    <InquiryDetailView
      error={error}
      inquiries={inquiries}
      inquiry={inquiry}
      memberSummary={(memberId) => <aside>要約 {memberId}</aside>}
      replyForm={<form aria-label="返信欄" />}
    />,
    paths,
  );
}

function summaryOf(
  failure: string | undefined,
  member: Readonly<{ email: string; id: string; name: string }> | undefined,
): string {
  return renderedAt(<MemberSummaryView failure={failure} summary={member} />, paths);
}

const yamada = { email: "yamada@example.com", id: "member-1", name: "山田" } as const;

describe("inquiry thread", () => {
  it("shows the failure", () => {
    expect(rendered("問い合わせを取得できませんでした。", undefined, undefined)).toContain(
      "問い合わせを取得できませんでした。",
    );
  });

  it("offers a way back to the list with the failure", () => {
    expect(rendered("失敗", undefined, undefined)).toContain('href="/inquiries"');
  });

  it("says it is loading until the list arrives", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), undefined)).toContain(
      "読み込み中です。",
    );
  });

  it("says it is loading until the thread arrives", () => {
    expect(rendered(undefined, undefined, [summary])).toContain("読み込み中です。");
  });

  it("lists the inquiries", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), [summary])).toContain(
      '<span class="block truncate text-sm">ログインできません</span>',
    );
  });

  it("marks the operator's messages", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), [summary])).toContain(
      '<li class="rounded-lg border border-border p-3 bg-muted">',
    );
  });

  it("shows the route and the status", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), [summary])).toContain("会員・受付");
  });

  it("offers the reply form while the inquiry is open", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), [summary])).toContain(
      'aria-label="返信欄"',
    );
  });

  it("shows the member summary", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), [summary])).toContain(
      "<aside>要約 member-1</aside>",
    );
  });

  it("hides the reply form once the inquiry is closed", () => {
    expect(rendered(undefined, thread(INQUIRY_STATUS.closed), [summary])).not.toContain(
      'aria-label="返信欄"',
    );
  });
});

describe("member summary", () => {
  it("says it is loading until the member arrives", () => {
    expect(summaryOf(undefined, undefined)).toContain("読み込み中です。");
  });

  it("shows the failure", () => {
    expect(summaryOf("利用者を取得できませんでした。", undefined)).toContain(
      "利用者を取得できませんでした。",
    );
  });

  it("drops the loading notice once the load failed", () => {
    expect(summaryOf("失敗", undefined)).not.toContain("読み込み中です。");
  });

  it("links to the member's detail page", () => {
    expect(summaryOf(undefined, yamada)).toContain('href="/members/member-1"');
  });
});
