import { REPORT_REASON, REPORT_STATUS } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { ReportView } from "./report-view.tsx";

import type { ReportDetail } from "#shared/contracts/index.ts";

type Report = typeof ReportDetail.Type;

const report: Report = {
  actions: [],
  body: "しつこく連絡してきます。",
  createdAt: 0,
  id: "report-1",
  reason: REPORT_REASON.harassment,
  reporterId: "member-2",
  reporterName: "佐藤",
  status: REPORT_STATUS.open,
  targetEmail: "yamada@example.com",
  targetMemberId: "member-1",
  targetName: "山田",
  targetSuspended: false,
};

function rendered(shown: Report, error?: string): string {
  return renderedAt(
    <ReportView blocked={false} error={error} onDecide={() => undefined} report={shown} />,
    ["/reports/report-1", "/reports", "/members/$id"],
  );
}

describe("report", () => {
  it("links the target and the reporter and labels the reason and status", () => {
    expect.hasAssertions();
    const html = rendered(report);
    expect(html).toContain('href="/members/member-1"');
    expect(html).toContain('href="/members/member-2"');
    expect(html).toContain("理由: 迷惑行為 / 状態: 未対応");
    expect(html).toContain("しつこく連絡してきます。");
    expect(html).not.toContain("停止を解除する");
  });

  it("names a member who left instead of linking them and keeps suspension disabled", () => {
    expect.hasAssertions();
    const html = rendered({ ...report, reporterId: null, targetMemberId: null });
    expect(html).toContain("対象: 退会した会員");
    expect(html).toContain("通報者: 退会した会員");
    expect(html).not.toContain('href="/members/');
    expect(html).toMatch(/<button[^>]*aria-label="対象を停止する"[^>]*disabled=""/u);
  });

  it("offers to lift a suspension and shows the failure", () => {
    expect.hasAssertions();
    const html = rendered({ ...report, targetSuspended: true }, "処理できませんでした。");
    expect(html).toContain("停止を解除する");
    expect(html).toContain('<p class="text-sm text-destructive">処理できませんでした。</p>');
  });
});
