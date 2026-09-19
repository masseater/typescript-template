import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function AuditPage(): ReactElement {
  return (
    <OpsPage title="監査ログ">
      <Status variant="pending">監査ログはまだありません。</Status>
    </OpsPage>
  );
}

export { AuditPage };
