import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function InvitePending(): ReactElement {
  return <StatusMessage variant={STATUS_VARIANT.pending}>招待を確認しています。</StatusMessage>;
}

export { InvitePending };
