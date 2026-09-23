import { Heading } from "@repo/ui";

import type { StaffInquiryCountsView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function InquiryCounts({ counts }: Readonly<{ counts: StaffInquiryCountsView }>): ReactElement {
  return (
    <>
      <section aria-label="件数" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-tight text-muted-foreground">受付</p>
          <Heading as="h2" size="section">
            {counts.byStatus.open}
          </Heading>
        </article>
        <article className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-tight text-muted-foreground">対応中</p>
          <Heading as="h2" size="section">
            {counts.byStatus.answered}
          </Heading>
        </article>
        <article className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-tight text-muted-foreground">完了</p>
          <Heading as="h2" size="section">
            {counts.byStatus.closed}
          </Heading>
        </article>
      </section>
      {counts.trend.length > 0 && (
        <section aria-label="推移">
          <Heading as="h2" size="section">
            直近 30 日の推移
          </Heading>
          <table aria-label="直近 30 日の推移" className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">日付</th>
                <th className="p-2">受付</th>
                <th className="p-2">対応中</th>
                <th className="p-2">完了</th>
              </tr>
            </thead>
            <tbody>
              {counts.trend.map((row) => (
                <tr key={row.day} className="border-b border-border">
                  <td className="p-2">{row.day}</td>
                  <td className="p-2">{row.open}</td>
                  <td className="p-2">{row.answered}</td>
                  <td className="p-2">{row.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

export { InquiryCounts };
