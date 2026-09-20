import { Avatar, formatWarekiDateTime } from "@repo/ui";

import { AuthorName, unavailableAuthor } from "./author-name.tsx";

import type { Thread } from "#pages/board/api/board.ts";
import type { ReactElement } from "react";

function PostItem({ post }: Readonly<{ post: Thread["posts"][number] }>): ReactElement {
  return (
    <li className="flex gap-3 rounded-lg border border-border p-3">
      <Avatar name={post.author?.name ?? unavailableAuthor} size="small" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm leading-normal">
          <AuthorName author={post.author} linked />
          <span className="ml-2 text-muted-foreground">{formatWarekiDateTime(post.createdAt)}</span>
        </p>
        <p className="text-base leading-normal break-words whitespace-pre-wrap">{post.body}</p>
      </div>
    </li>
  );
}

export { PostItem };
