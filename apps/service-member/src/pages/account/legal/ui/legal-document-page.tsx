import { Page, STATUS_VARIANT, StatusMessage, formatWarekiDate } from "@repo/ui";

import { agreementKindLabels } from "#entities/agreement/index.ts";

import type { PublishedAgreementView } from "#shared/contracts/index.ts";
import type { AgreementKind } from "@repo/config";
import type { ReactElement } from "react";

function LegalDocumentPage({
  document,
  kind,
}: Readonly<{
  document: typeof PublishedAgreementView.Type | undefined;
  kind: AgreementKind;
}>): ReactElement {
  return (
    <Page title={agreementKindLabels[kind]}>
      {document === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          公開されている{agreementKindLabels[kind]}はまだありません。
        </StatusMessage>
      ) : (
        <>
          <p className="text-sm leading-normal text-muted-foreground">
            版 {document.version}・{formatWarekiDate(new Date(document.publishedAt))}公開
          </p>
          <article className="text-base leading-relaxed whitespace-pre-wrap text-foreground">
            {document.body}
          </article>
        </>
      )}
    </Page>
  );
}

export { LegalDocumentPage };
