import { Heading, Page, StatusMessage, TextLink, formatWarekiDate } from "@repo/ui";

import { PendingAgreementList, agreementKindLabels } from "#entities/agreement/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";

function AgreementsPage({ agreements }: Readonly<{ agreements: Agreements }>): ReactElement {
  const { accepted, pending } = agreements;
  return (
    <Page title="規約への同意">
      <section className="flex flex-col gap-2">
        <Heading as="h2" size="section">
          未同意の版
        </Heading>
        {pending.length === 0 ? (
          <StatusMessage>最新の規約に同意しています。</StatusMessage>
        ) : (
          <>
            <PendingAgreementList pending={pending} />
            <p className="text-sm leading-normal text-foreground">
              <TextLink to="/agreement">同意の画面へ</TextLink>
            </p>
          </>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <Heading as="h2" size="section">
          同意の履歴
        </Heading>
        {accepted.length === 0 ? (
          <StatusMessage>同意の記録はまだありません。</StatusMessage>
        ) : (
          <ul className="flex flex-col gap-1 text-sm leading-normal text-foreground">
            {accepted.map((agreement) => (
              <li key={agreement.versionId}>
                {agreementKindLabels[agreement.kind]}（{agreement.version}）に
                {formatWarekiDate(new Date(agreement.acceptedAt))}同意
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

export { AgreementsPage };
