import { Status } from "@repo/ui";

import { ChatEntry } from "./chat-entry.tsx";
import { QueuedMessage } from "./queued-message.tsx";

import type { ChatState } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

function ChatLog({ chat }: Readonly<{ chat: ChatState }>): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      <div className="flex flex-col gap-2">
        {chat.entries.length === 0 && chat.queued.length === 0 ? (
          <Status>頼みたいことをそのまま書いてください。</Status>
        ) : undefined}
        {chat.entries.map((entry) => (
          <ChatEntry key={entry.id} body={entry.body} />
        ))}
        {chat.busy ? <Status variant="pending">進めています…</Status> : undefined}
        {chat.queued.map((message) => (
          <QueuedMessage key={message.id} text={message.text} />
        ))}
      </div>
    </div>
  );
}

export { ChatLog };
