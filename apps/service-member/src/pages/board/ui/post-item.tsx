import { REPORT_SUBJECT } from "@repo/config";
import { Avatar, formatWarekiDateTime } from "@repo/ui";

import { unavailableAuthor } from "#pages/board/model/author-labels.ts";
import { ReportControl } from "#shared/ui/index.ts";
import { AuthorName } from "./author-name.tsx";

import type { Thread } from "#pages/board/api/board.ts";
import type { ReactElement } from "react";

type Post = Thread["posts"][number];

function authorLabel(author: Post["author"]): string {
  return author?.name ?? unavailableAuthor;
}

function PostReport({ post }: Readonly<{ post: Post }>): ReactElement | undefined {
  if (post.author === null || post.author === undefined) {
    return undefined;
  }
  return <ReportControl subjectId={post.id} subjectKind={REPORT_SUBJECT.boardPost} />;
}

function PostItem({ post }: Readonly<{ post: Post }>): ReactElement {
  return (
    <li className="flex gap-3 rounded-lg border border-border p-3">
      <Avatar name={authorLabel(post.author)} size="small" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm leading-normal">
          <AuthorName author={post.author} linked />
          <span className="ml-2 text-muted-foreground">{formatWarekiDateTime(post.createdAt)}</span>
        </p>
        <p className="text-base leading-normal break-words whitespace-pre-wrap">{post.body}</p>
        <PostReport post={post} />
      </div>
    </li>
  );
}

export { PostItem };
