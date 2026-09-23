import { CLIENT_KIND, METRIC_KEY } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { OverviewView } from "./overview-view.tsx";

import type { StaffOverviewView } from "#shared/contracts/index.ts";

const overview = {
  cards: [{ metric: METRIC_KEY.memberCount, value: 42 }],
  trend: [{ bucket: "2026-04-01", clientKind: CLIENT_KIND.total, value: 40 }],
} as const satisfies StaffOverviewView;

function rendered(error: string | undefined, loaded: StaffOverviewView | undefined): string {
  return renderedAt(<OverviewView error={error} overview={loaded} />, ["/"]);
}

describe("overview", () => {
  it("says it is loading until the overview arrives", () => {
    expect.hasAssertions();
    const html = rendered(undefined, undefined);
    expect(html).toContain("読み込み中です。");
    expect(html).not.toContain('aria-label="集計"');
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered("概要を取得できませんでした。", undefined);
    expect(html).toContain('<p class="text-sm text-destructive">概要を取得できませんでした。</p>');
    expect(html).not.toContain("読み込み中です。");
  });

  it("shows each card and the recent trend", () => {
    expect.hasAssertions();
    const html = rendered(undefined, overview);
    expect(html).toContain("会員数");
    expect(html).toContain(">42</h2>");
    expect(html).toContain('aria-label="会員数の直近推移"');
    expect(html).toContain('<td class="p-2">2026-04-01</td><td class="p-2">40</td>');
    expect(html).not.toContain("推移のグラフはまだありません。");
  });

  it("says there is no trend yet when the trend is empty", () => {
    expect.hasAssertions();
    const html = rendered(undefined, { cards: overview.cards, trend: [] });
    expect(html).toContain("推移のグラフはまだありません。");
    expect(html).not.toContain('aria-label="会員数の直近推移"');
  });
});
