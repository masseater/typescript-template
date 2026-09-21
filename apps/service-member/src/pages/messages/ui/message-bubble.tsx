import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ReactElement } from "react";

function MessageBubble({
  message,
}: Readonly<{ message: ConversationThread["messages"][number] }>): ReactElement {
  const alignment = message.mine ? "justify-end" : "justify-start";
  const tone = message.mine
    ? "bg-primary text-primary-foreground"
    : "border border-border bg-card text-card-foreground";
  return (
    <li className={`flex ${alignment}`}>
      <div className={`rounded-2xl max-w-[85%] px-4 py-2 text-base leading-relaxed ${tone}`}>
        {!message.mine && (
          <p className="mb-1 text-xs leading-tight font-bold opacity-80">{message.sender.name}</p>
        )}
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
    </li>
  );
}

export { MessageBubble };
