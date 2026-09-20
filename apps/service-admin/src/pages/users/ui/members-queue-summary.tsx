import { Heading } from "@repo/ui";

import type { ReactElement } from "react";

type QueueCard = Readonly<{
  label: string;
  value: number;
}>;

const queueCards: readonly QueueCard[] = [
  { label: "対応待ちの問い合わせ", value: 5 },
  { label: "対応待ちの通報", value: 2 },
  { label: "確認が必要な利用者", value: 3 },
];

function MembersQueueSummary(): ReactElement {
  return (
    <section aria-label="対応待ち" className="grid gap-3 sm:grid-cols-3">
      {queueCards.map((card) => (
        <article key={card.label} className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-tight text-muted-foreground">{card.label}</p>
          <Heading as="h2" size="section">
            {card.value}
          </Heading>
        </article>
      ))}
    </section>
  );
}

export { MembersQueueSummary };
