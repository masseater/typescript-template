import { INQUIRY_STATUS } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InquiryListing } from "./inquiry-listing.tsx";

import type { InquirySummary } from "#pages/support/model/inquiry.ts";

const inquiry = {
  createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-04-01T09:00:00Z")),
  id: "inquiry-1",
  status: INQUIRY_STATUS.open,
  statusLabel: "対応待ち",
  subject: "ログインできません",
  updatedAt: DateTime.toDate(DateTime.makeUnsafe("2026-04-02T09:00:00Z")),
} as const satisfies InquirySummary;

function rendered(
  error: string | undefined,
  inquiries: readonly InquirySummary[] | undefined,
): string {
  return renderedAt(<InquiryListing error={error} inquiries={inquiries} />, [
    "/support",
    "/support/$id",
  ]);
}

describe("inquiry listing", () => {
  it("says it is loading until the inquiries arrive", () => {
    expect.hasAssertions();
    expect(rendered(undefined, undefined)).toContain("読み込み中です。");
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered("取得できませんでした。", undefined);
    expect(html).toContain("取得できませんでした。");
    expect(html).not.toContain("読み込み中です。");
  });

  it("says there are no inquiries yet", () => {
    expect.hasAssertions();
    const html = rendered(undefined, []);
    expect(html).toContain("まだ問い合わせはありません。");
    expect(html).not.toContain("<ul");
  });

  it("links each inquiry with its status", () => {
    expect.hasAssertions();
    const html = rendered(undefined, [inquiry]);
    expect(html).toContain('href="/support/inquiry-1"');
    expect(html).toContain(inquiry.subject);
    expect(html).toContain(inquiry.statusLabel);
  });
});
