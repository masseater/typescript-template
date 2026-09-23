import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function AuditPage(): ReactElement {
  return (
    <Page title="監査ログ">
      <StatusMessage variant={STATUS_VARIANT.empty}>監査ログはまだありません。</StatusMessage>
    </Page>
  );
}

export { AuditPage };
