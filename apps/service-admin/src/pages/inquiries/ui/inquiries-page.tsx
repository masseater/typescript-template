import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  return (
    <OpsPage title="問い合わせ">
      <StatusMessage variant={STATUS_VARIANT.pending}>
        問い合わせの一覧はまだありません。
      </StatusMessage>
    </OpsPage>
  );
}

export { InquiriesPage };
