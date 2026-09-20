import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function TermsPage(): ReactElement {
  return (
    <OpsPage title="規約">
      <StatusMessage variant={STATUS_VARIANT.pending}>規約の一覧はまだありません。</StatusMessage>
    </OpsPage>
  );
}

export { TermsPage };
