import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { ChatEntry } from "./chat-entry.tsx";
import { QueuedMessage } from "./queued-message.tsx";

import type { ChatState } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

function ChatLog({ chat }: Readonly<{ chat: ChatState }>): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      <div className="flex flex-col gap-2">
        {chat.entries.length === 0 && chat.queued.length === 0 ? (
          <StatusMessage>頼みたいことをそのまま書いてください。</StatusMessage>
        ) : undefined}
        {chat.entries.map((entry) => (
          <ChatEntry key={entry.id} body={entry.body} />
        ))}
        {chat.busy ? (
          <StatusMessage variant={STATUS_VARIANT.pending}>進めています…</StatusMessage>
        ) : undefined}
        {chat.queued.map((message) => (
          <QueuedMessage key={message.id} text={message.text} />
        ))}
      </div>
    </div>
  );
}

export { ChatLog };
