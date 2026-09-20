import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function OverviewPage(): ReactElement {
  return (
    <OpsPage title="概要">
      <StatusMessage variant={STATUS_VARIANT.pending}>概要の集計はまだありません。</StatusMessage>
    </OpsPage>
  );
}

export { OverviewPage };
