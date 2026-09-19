import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  return (
    <OpsPage title="問い合わせ">
      <Status variant="pending">問い合わせの一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { InquiriesPage };
