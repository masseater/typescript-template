import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { MessagesBody } from "./messages-body.tsx";

import type { ReactElement } from "react";

const placeholders = ["first", "second", "third"] as const;

function MessagesPending(): ReactElement {
  return (
    <MessagesBody>
      <StatusMessage variant={STATUS_VARIANT.pending}>メッセージを読み込んでいます。</StatusMessage>
      <ul aria-hidden="true" className="flex flex-col gap-3">
        {placeholders.map((name) => (
          <li key={name} className="h-16 rounded-lg border border-border bg-muted" />
        ))}
      </ul>
    </MessagesBody>
  );
}

export { MessagesPending };
