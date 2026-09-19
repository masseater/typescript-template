import { Heading } from "@repo/ui";

import type { ReactElement, ReactNode } from "react";

function MetricCards({
  items,
}: Readonly<{
  items: readonly Readonly<{ label: string; value: string }>[];
}>): ReactElement {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.label}
          className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
        >
          <p className="text-sm leading-tight text-muted-foreground">{item.label}</p>
          <p className="text-2xl leading-tight font-bold text-foreground">{item.value}</p>
        </li>
      ))}
    </ul>
  );
}

function MockPage({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        {title}
      </Heading>
      <p className="text-sm leading-normal text-muted-foreground">見た目確認用のモックです。</p>
      {children}
    </main>
  );
}

export { MetricCards, MockPage };
