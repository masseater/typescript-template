import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function ReportsPage(): ReactElement {
  return (
    <OpsPage title="通報">
      <StatusMessage variant={STATUS_VARIANT.empty}>通報の一覧はまだありません。</StatusMessage>
    </OpsPage>
  );
}

export { ReportsPage };
