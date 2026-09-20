import { CardLink, formatWarekiDateTime } from "@repo/ui";

import { unavailableAuthor } from "./author-name.tsx";

import type { ThreadList } from "#pages/board/api/board.ts";
import type { ReactElement } from "react";

function ThreadRow({ thread }: Readonly<{ thread: ThreadList["threads"][number] }>): ReactElement {
  return (
    <li>
      <CardLink to="/board/$id" params={{ id: thread.id }}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base leading-tight font-bold">{thread.title}</span>
          <span className="text-sm leading-normal text-muted-foreground">
            {thread.author?.name ?? unavailableAuthor} ・ 最終投稿{" "}
            {formatWarekiDateTime(thread.lastPostedAt)} ・ {thread.postCount} 件
          </span>
        </div>
      </CardLink>
    </li>
  );
}

export { ThreadRow };
