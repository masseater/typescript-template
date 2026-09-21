import { Heading, STATUS_VARIANT, StatusMessage, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { metricLabel } from "#pages/overview/model/metric-label.ts";
import { useOverview } from "#pages/overview/model/overview.ts";

import type { ReactElement } from "react";

function OverviewPage(): ReactElement {
  const listing = useOverview();
  const error = resultError(listing);
  const overview = AsyncResult.isSuccess(listing) ? listing.value : undefined;

  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        概要
      </Heading>
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
          <Heading as="h2" id="member-trend-heading" size="section">
            会員数の直近推移
          </Heading>
          <table
            aria-labelledby="member-trend-heading"
            className="w-full border-collapse text-left text-sm"
          >
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">日付</th>
                <th className="p-2">会員数</th>
              </tr>
            </thead>
            <tbody>
              {overview.trend.map((row) => (
                <tr key={row.bucket} className="border-b border-border">
                  <td className="p-2">{row.bucket}</td>
                  <td className="p-2">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </main>
  );
}

export { OverviewPage };
