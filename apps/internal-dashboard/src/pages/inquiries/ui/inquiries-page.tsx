import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  return (
    <Page layout="full" title="問い合わせ">
      <p className="text-base leading-normal text-muted-foreground">
        読むだけの画面です。返信は管理者アプリで行います。
      </p>
      <StatusMessage variant={STATUS_VARIANT.empty}>
        問い合わせの一覧はまだありません。
      </StatusMessage>
    </Page>
  );
}

export { InquiriesPage };
