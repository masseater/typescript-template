import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function AdminsPage(): ReactElement {
  return (
    <OpsPage title="管理者">
      <Status variant="pending">管理者の一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { AdminsPage };
