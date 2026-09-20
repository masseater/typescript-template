import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { ThreadBody } from "./thread-body.tsx";

import type { ReactElement } from "react";

function ThreadPending(): ReactElement {
  return (
    <ThreadBody>
      <span className="h-8 w-64 rounded-md bg-muted" />
      <StatusMessage variant={STATUS_VARIANT.pending}>スレッドを読み込んでいます。</StatusMessage>
    </ThreadBody>
  );
}

export { ThreadPending };
