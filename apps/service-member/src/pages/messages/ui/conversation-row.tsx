import { Avatar, CardLink } from "@repo/ui";

import type { ConversationListView } from "#pages/messages/api/messages.ts";
import type { ReactElement } from "react";

function preview(body: string): string {
  const line = body.split("\n")[0] ?? "";
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

function ConversationRow({
  conversation,
}: Readonly<{ conversation: ConversationListView["conversations"][number] }>): ReactElement {
  const title = conversation.kind === "direct" ? conversation.peer.name : conversation.group.name;
  return (
    <li>
      <CardLink to="/messages/$id" params={{ id: conversation.id }}>
        <Avatar name={title} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base leading-tight font-bold">{title}</span>
            {conversation.unreadCount > 0 && (
              <span
                aria-label={`未読 ${conversation.unreadCount} 件`}
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-tight font-bold text-primary-foreground"
              >
                {conversation.unreadCount}
              </span>
            )}
          </div>
          <span className="truncate text-sm leading-normal text-muted-foreground">
            {preview(conversation.lastMessagePreview)}
          </span>
        </div>
      </CardLink>
    </li>
  );
}

export { ConversationRow };
