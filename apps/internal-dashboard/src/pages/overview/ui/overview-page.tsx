import { Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

type OverviewCard = Readonly<{
  label: string;
  value: string;
}>;

const overviewCards: readonly OverviewCard[] = [
  { label: "アクティブ利用者", value: "—" },
  { label: "今日の問い合わせ", value: "—" },
  { label: "未解決の通報", value: "—" },
];

function OverviewPage(): ReactElement {
  return (
    <OpsPage title="概要">
      <section aria-label="集計" className="grid gap-3 sm:grid-cols-3">
        {overviewCards.map((card) => (
          <article key={card.label} className="rounded-lg border border-border p-3">
            <p className="text-sm leading-tight text-muted-foreground">{card.label}</p>
            <Heading as="h2" size="section">
              {card.value}
            </Heading>
          </article>
        ))}
      </section>
      <section aria-label="推移" className="rounded-lg border border-border p-3">
        <Heading as="h2" size="section">
          推移
        </Heading>
        <StatusMessage variant={STATUS_VARIANT.pending}>
          推移のグラフはまだありません。
        </StatusMessage>
      </section>
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noreferrer"
        className="w-fit rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
      >
        Google Analytics を開く
      </a>
    </OpsPage>
  );
}

export { OverviewPage };
