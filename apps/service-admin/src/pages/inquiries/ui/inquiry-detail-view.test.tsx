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

describe("inquiry thread", () => {
  it("shows the failure with a way back to the list", () => {
    expect.hasAssertions();
    const html = rendered("問い合わせを取得できませんでした。", undefined, undefined);
    expect(html).toContain('role="alert"');
    expect(html).toContain("問い合わせを取得できませんでした。");
    expect(html).toContain('href="/inquiries"');
  });

  it("says it is loading until both the thread and the list arrive", () => {
    expect.hasAssertions();
    expect(rendered(undefined, thread(INQUIRY_STATUS.open), undefined)).toContain(
      "読み込み中です。",
    );
    expect(rendered(undefined, undefined, [summary])).toContain("読み込み中です。");
  });

  it("shows the list, the messages, the reply form and the member summary", () => {
    expect.hasAssertions();
    const html = rendered(undefined, thread(INQUIRY_STATUS.open), [summary]);
    expect(html).toContain('<span class="block truncate text-sm">ログインできません</span>');
    expect(html).toContain('<li class="rounded-lg border border-border p-3 bg-muted">');
    expect(html).toContain('<li class="rounded-lg border border-border p-3 ">');
    expect(html).toContain("会員・受付");
    expect(html).toContain('aria-label="返信欄"');
    expect(html).toContain("<aside>要約 member-1</aside>");
  });

  it("hides the reply form once the inquiry is closed", () => {
    expect.hasAssertions();
    const html = rendered(undefined, thread(INQUIRY_STATUS.closed), [summary]);
    expect(html).toContain("会員・完了");
    expect(html).not.toContain('aria-label="返信欄"');
  });
});

describe("member summary", () => {
  function summaryOf(
    failure: string | undefined,
    member: Readonly<{ email: string; id: string; name: string }> | undefined,
  ): string {
    return renderedAt(<MemberSummaryView failure={failure} summary={member} />, paths);
  }

  it("says it is loading until the member arrives", () => {
    expect.hasAssertions();
    expect(summaryOf(undefined, undefined)).toContain("読み込み中です。");
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = summaryOf("利用者を取得できませんでした。", undefined);
    expect(html).toContain("利用者を取得できませんでした。");
    expect(html).not.toContain("読み込み中です。");
  });

  it("links to the member's detail page", () => {
    expect.hasAssertions();
    const html = summaryOf(undefined, {
      email: "yamada@example.com",
      id: "member-1",
      name: "山田",
    });
    expect(html).toContain("yamada@example.com");
    expect(html).toContain('href="/members/member-1"');
  });
});
