import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function ReportsPage(): ReactElement {
  return (
    <Page layout="full" title="通報">
      <StatusMessage variant={STATUS_VARIANT.empty}>通報の一覧はまだありません。</StatusMessage>
    </Page>
  );
}

export { ReportsPage };
