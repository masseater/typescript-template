import { ChatEntry } from "./chat-entry.tsx";
import type { ChatState } from "#contract.ts";
import type { ReactElement } from "react";
import { Status } from "@repo/ui";

function ChatLog({ chat }: Readonly<{ chat: ChatState }>): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      <div className="flex flex-col gap-2">
        {chat.entries.length === 0 ? (
          <Status>頼みたいことをそのまま書いてください。</Status>
        ) : undefined}
        {chat.entries.map((entry) => (
          <ChatEntry key={entry.id} body={entry.body} />
        ))}
        {chat.busy ? <Status variant="pending">進めています…</Status> : undefined}
      </div>
    </div>
  );
}

export { ChatLog };
