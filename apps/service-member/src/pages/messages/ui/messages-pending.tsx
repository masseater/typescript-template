import { MessagesBody } from "./messages-body.tsx";

import type { ReactElement } from "react";

function MessagesPending(): ReactElement {
  return <MessagesBody>読み込み中…</MessagesBody>;
}

export { MessagesPending };
