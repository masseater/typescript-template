import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  return (
    <OpsPage title="機能フラグ">
      <Status variant="pending">機能フラグの一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { FlagsPage };
