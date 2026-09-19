import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function StaffPage(): ReactElement {
  return (
    <OpsPage title="メンバー">
      <Status variant="pending">メンバーの一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { StaffPage };
