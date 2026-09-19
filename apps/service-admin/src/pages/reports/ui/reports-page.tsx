import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function ReportsPage(): ReactElement {
  return (
    <OpsPage title="通報">
      <Status variant="pending">通報の一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { ReportsPage };
