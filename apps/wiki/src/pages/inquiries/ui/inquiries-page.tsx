import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  return (
    <OpsPage title="問い合わせ">
      <p className="text-base leading-normal text-muted-foreground">
        読むだけの画面です。返信は管理者アプリで行います。
      </p>
      <Status variant="pending">問い合わせの一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { InquiriesPage };
