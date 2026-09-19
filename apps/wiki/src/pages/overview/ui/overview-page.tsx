import { MetricCards, MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const metrics = [
  { label: "アクティブ利用者", value: "1,284" },
  { label: "新規登録（7日）", value: "96" },
  { label: "問い合わせ未対応", value: "5" },
  { label: "通報未処置", value: "2" },
] as const;

const trend = [28, 34, 31, 42, 39, 48, 52, 47, 55, 61, 58, 66] as const;

function OverviewPage(): ReactElement {
  const max = Math.max(...trend);
  return (
    <MockPage title="概要">
      <MetricCards items={metrics} />
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="text-lg leading-tight font-bold text-foreground">利用者数の推移</h2>
        <div className="flex h-40 items-end gap-2">
          {trend.map((value, index) => (
            <div
              key={`week-${String(index + 1)}`}
              title={`${String(value)}`}
              className="flex-1 rounded-t-md bg-primary/80"
              style={{ height: `${(value / max) * 100}%` }}
            />
          ))}
        </div>
      </section>
    </MockPage>
  );
}

export { OverviewPage };
