import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function AuditPage(): ReactElement {
  return (
    <OpsPage title="監査ログ">
      <StatusMessage variant={STATUS_VARIANT.pending}>監査ログはまだありません。</StatusMessage>
    </OpsPage>
  );
}

export { AuditPage };
