import { ConversationBody } from "./conversation-body.tsx";

import type { ReactElement } from "react";

function ConversationPending(): ReactElement {
  return <ConversationBody>読み込み中…</ConversationBody>;
}

export { ConversationPending };
