import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  return (
    <Page layout="full" title="問い合わせ">
      <StatusMessage variant={STATUS_VARIANT.empty}>
        問い合わせの一覧はまだありません。
      </StatusMessage>
    </Page>
  );
}

export { InquiriesPage };
