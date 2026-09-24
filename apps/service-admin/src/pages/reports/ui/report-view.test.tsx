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

const departed: Report = { ...report, reporterId: null, targetMemberId: null };

function rendered(shown: Report, error?: string): string {
  return renderedAt(
    <ReportView blocked={false} error={error} onDecide={() => undefined} report={shown} />,
    ["/reports/report-1", "/reports", "/members/$id"],
  );
}

describe("report", () => {
  it("links the target", () => {
    expect(rendered(report)).toContain('href="/members/member-1"');
  });

  it("links the reporter", () => {
    expect(rendered(report)).toContain('href="/members/member-2"');
  });

  it("labels the reason and the status", () => {
    expect(rendered(report)).toContain("理由: 迷惑行為 / 状態: 未対応");
  });

  it("offers no lifting for a member who is not suspended", () => {
    expect(rendered(report)).not.toContain("停止を解除する");
  });

  it("links no member who left", () => {
    expect(rendered(departed)).not.toContain('href="/members/');
  });

  it("names a member who left", () => {
    expect(rendered(departed)).toContain("退会した会員");
  });

  it("keeps suspension disabled for a target who left", () => {
    expect(rendered(departed)).toMatch(/<button[^>]*aria-label="対象を停止する"[^>]*disabled=""/u);
  });

  it("offers to lift a suspension", () => {
    expect(rendered({ ...report, targetSuspended: true })).toContain("停止を解除する");
  });

  it("shows the failure", () => {
    expect(rendered(report, "処理できませんでした。")).toContain(
      '<p class="text-sm text-destructive">処理できませんでした。</p>',
    );
  });
});
