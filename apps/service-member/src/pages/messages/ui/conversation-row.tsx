import { Avatar, CardLink, formatWarekiDateTime } from "@repo/ui";

import type { ConversationListView } from "#pages/messages/api/messages.ts";
import type { ReactElement } from "react";

function ConversationRow({
  conversation,
}: Readonly<{ conversation: ConversationListView["conversations"][number] }>): ReactElement {
  return (
    <li>
      <CardLink to="/messages/$id" params={{ id: conversation.id }}>
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={conversation.peer.name} size="small" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-base leading-tight font-bold">
                {conversation.peer.name}
              </span>
              {conversation.unreadCount > 0 ? (
                <span className="shrink-0 text-sm leading-none font-bold text-secondary-foreground">
                  未読
                </span>
              ) : null}
            </span>
            <span className="truncate text-sm leading-normal text-muted-foreground">
              {conversation.lastMessagePreview}
            </span>
            <span className="text-sm leading-normal text-muted-foreground">
              {formatWarekiDateTime(conversation.lastMessageAt)}
            </span>
          </span>
        </span>
      </CardLink>
    </li>
  );
}

export { ConversationRow };
