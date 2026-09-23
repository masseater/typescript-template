import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function StaffPage(): ReactElement {
  return (
    <Page title="メンバー">
      <StatusMessage variant={STATUS_VARIANT.empty}>メンバーの一覧はまだありません。</StatusMessage>
    </Page>
  );
}

export { StaffPage };
