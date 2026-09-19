import { Status } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

function TermsPage(): ReactElement {
  return (
    <OpsPage title="規約">
      <Status variant="pending">規約の一覧はまだありません。</Status>
    </OpsPage>
  );
}

export { TermsPage };
