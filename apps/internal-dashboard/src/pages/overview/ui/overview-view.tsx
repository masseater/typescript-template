import { Heading, Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { metricLabel } from "#pages/overview/model/metric-label.ts";
import { DataTable } from "#shared/ui/data-table.tsx";

import type { StaffOverviewView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function OverviewView({
  error,
  overview,
}: Readonly<{ error: string | undefined; overview: StaffOverviewView | undefined }>): ReactElement {
  return (
    <Page title="概要">
      {overview === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {overview !== undefined && (
        <section aria-label="集計" className="grid gap-3 sm:grid-cols-3">
          {overview.cards.map((card) => (
            <article key={card.metric} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm leading-tight text-muted-foreground">
                {metricLabel(card.metric)}
              </p>
              <Heading as="h2" size="section">
                {card.value}
              </Heading>
            </article>
          ))}
        </section>
      )}
      {overview !== undefined && overview.trend.length > 0 && (
        <section aria-label="推移">
          <Heading as="h2" size="section">
            会員数の直近推移
          </Heading>
          <DataTable
            columns={["日付", "会員数"]}
            label="会員数の直近推移"
            rows={overview.trend.map((row) => (
              <tr key={row.bucket} className="border-b border-border">
                <td className="p-2">{row.bucket}</td>
                <td className="p-2">{row.value}</td>
              </tr>
            ))}
          />
        </section>
      )}
      {overview !== undefined && overview.trend.length === 0 && (
        <section aria-label="推移" className="rounded-lg border border-border p-3">
          <Heading as="h2" size="section">
            推移
          </Heading>
          <StatusMessage variant={STATUS_VARIANT.empty}>
            推移のグラフはまだありません。
          </StatusMessage>
        </section>
      )}
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noreferrer"
        className="w-fit rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
      >
        Google Analytics を開く
      </a>
    </Page>
  );
}

export { OverviewView };
