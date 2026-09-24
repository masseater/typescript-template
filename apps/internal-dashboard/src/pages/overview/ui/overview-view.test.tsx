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
    expect(rendered(undefined, undefined)).toContain("読み込み中です。");
  });

  it("shows no cards while loading", () => {
    expect(rendered(undefined, undefined)).not.toContain('aria-label="集計"');
  });

  it("shows the failure", () => {
    expect(rendered("概要を取得できませんでした。", undefined)).toContain(
      '<p class="text-sm text-destructive">概要を取得できませんでした。</p>',
    );
  });

  it("drops the loading notice once the load failed", () => {
    expect(rendered("失敗", undefined)).not.toContain("読み込み中です。");
  });

  it("shows each card value", () => {
    expect(rendered(undefined, overview)).toContain(">42</h2>");
  });

  it("shows the recent trend rows", () => {
    expect(rendered(undefined, overview)).toContain(
      '<td class="p-2">2026-04-01</td><td class="p-2">40</td>',
    );
  });

  it("says there is no trend yet when the trend is empty", () => {
    expect(rendered(undefined, { cards: overview.cards, trend: [] })).toContain(
      "推移のグラフはまだありません。",
    );
  });

  it("hides the trend table when the trend is empty", () => {
    expect(rendered(undefined, { cards: overview.cards, trend: [] })).not.toContain(
      'aria-label="会員数の直近推移"',
    );
  });
});
