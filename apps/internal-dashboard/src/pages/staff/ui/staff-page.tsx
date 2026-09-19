import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function StaffPage(): ReactElement {
  return (
    <OpsPage title="メンバー">
      <StatusMessage variant={STATUS_VARIANT.pending}>
        メンバーの一覧はまだありません。
      </StatusMessage>
    </OpsPage>
  );
}

export { StaffPage };
