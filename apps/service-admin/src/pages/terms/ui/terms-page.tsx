import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function TermsPage(): ReactElement {
  return (
    <Page title="規約">
      <StatusMessage variant={STATUS_VARIANT.empty}>規約の一覧はまだありません。</StatusMessage>
    </Page>
  );
}

export { TermsPage };
