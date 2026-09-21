import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { ConversationBody } from "./conversation-body.tsx";

import type { ReactElement } from "react";

function ConversationPending(): ReactElement {
  return (
    <ConversationBody>
      <StatusMessage variant={STATUS_VARIANT.pending}>会話を読み込んでいます。</StatusMessage>
    </ConversationBody>
  );
}

export { ConversationPending };
