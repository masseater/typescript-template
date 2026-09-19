import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function OverviewPage(): ReactElement {
  return (
    <OpsPage title="概要">
      <Status variant="pending">概要の集計はまだありません。</Status>
    </OpsPage>
  );
}

export { OverviewPage };
