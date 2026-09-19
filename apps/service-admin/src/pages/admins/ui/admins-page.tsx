import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function AdminsPage(): ReactElement {
  return (
    <OpsPage title="管理者">
      <StatusMessage variant={STATUS_VARIANT.pending}>管理者の一覧はまだありません。</StatusMessage>
    </OpsPage>
  );
}

export { AdminsPage };
