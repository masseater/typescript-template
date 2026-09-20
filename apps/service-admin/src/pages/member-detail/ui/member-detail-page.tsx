import { Heading, Status } from "@repo/ui";

import type { ReactElement } from "react";

function MemberDetailPage({ memberId }: Readonly<{ memberId: string }>): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        利用者の詳細
      </Heading>
      <p className="text-base leading-tight text-muted-foreground">利用者 ID: {memberId}</p>
      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-border p-3">
          <Heading as="h2" size="section">
            状態
          </Heading>
          <Status variant="pending">状態の要約はまだありません。</Status>
        </article>
        <article className="rounded-lg border border-border p-3">
          <Heading as="h2" size="section">
            契約
          </Heading>
          <Status variant="pending">契約の要約はまだありません。</Status>
        </article>
        <article className="rounded-lg border border-border p-3">
          <Heading as="h2" size="section">
            問い合わせ
          </Heading>
          <Status variant="pending">問い合わせの履歴はまだありません。</Status>
        </article>
        <article className="rounded-lg border border-border p-3">
          <Heading as="h2" size="section">
            通報と処置
          </Heading>
          <Status variant="pending">通報と処置の履歴はまだありません。</Status>
        </article>
      </section>
    </main>
  );
}

export { MemberDetailPage };
