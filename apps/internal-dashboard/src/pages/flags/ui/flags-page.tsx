import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  return (
    <OpsPage title="機能フラグ">
      <StatusMessage variant={STATUS_VARIANT.pending}>
        機能フラグの一覧はまだありません。
      </StatusMessage>
    </OpsPage>
  );
}

export { FlagsPage };
