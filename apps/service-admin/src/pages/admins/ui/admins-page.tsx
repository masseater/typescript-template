import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function AdminsPage(): ReactElement {
  return (
    <Page title="管理者">
      <StatusMessage variant={STATUS_VARIANT.empty}>管理者の一覧はまだありません。</StatusMessage>
    </Page>
  );
}

export { AdminsPage };
