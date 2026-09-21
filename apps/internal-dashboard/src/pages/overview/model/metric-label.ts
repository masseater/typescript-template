import type { StaffOverviewView } from "#shared/contracts/index.ts";

type OverviewMetric = StaffOverviewView["cards"][number]["metric"];

const metricLabels: Readonly<Record<OverviewMetric, string>> = {
  member_count: "会員数",
  message_count: "メッセージ数",
  paid_member_count: "有料会員数",
  wiki_session_count: "Wiki セッション数",
};

function metricLabel(metric: OverviewMetric): string {
  return metricLabels[metric];
}

export { metricLabel };
