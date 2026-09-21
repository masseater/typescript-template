import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ReactElement } from "react";

function MessageBubble({
  message,
}: Readonly<{ message: ConversationThread["messages"][number] }>): ReactElement {
  return (
    <li className={message.mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`flex max-w-[80%] flex-col gap-1 rounded-lg border border-border px-3 py-2 ${message.mine ? "bg-secondary text-secondary-foreground" : "bg-card"}`}
      >
        <p className="text-sm leading-normal text-muted-foreground">{message.sender.name}</p>
        <p className="text-base leading-normal break-words whitespace-pre-wrap">{message.body}</p>
      </div>
    </li>
  );
}

export { MessageBubble };
