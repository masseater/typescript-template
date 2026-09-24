import { Heading, PageNavigation } from "@repo/ui";

import { lastPage } from "#shared/ui/index.ts";
import { PostItem } from "./post-item.tsx";
import { ReplyForm } from "./reply-form.tsx";
import { ThreadBody } from "./thread-body.tsx";
import { ThreadPageLink } from "./thread-page-link.tsx";

import type { Thread } from "#pages/board/api/board.ts";
import type { ThreadSearch } from "#pages/board/model/board-search.ts";
import type { ReactElement } from "react";

function ThreadPage({
  search,
  thread,
}: Readonly<{ search: ThreadSearch; thread: Thread }>): ReactElement {
  const threadId = thread.thread.id;
  return (
    <ThreadBody>
      <Heading as="h1" size="page">
        {thread.thread.title}
      </Heading>
      <p className="text-sm leading-normal text-muted-foreground">{thread.total} 件の投稿</p>
      <ul className="flex flex-col gap-3">
        {thread.posts.map((post) => (
          <PostItem key={post.id} post={post} />
        ))}
      </ul>
      <PageNavigation
        current={search.page ?? 1}
        last={lastPage(thread.total, thread.pageSize)}
        renderLink={(target) => <ThreadPageLink target={target} threadId={threadId} />}
      />
      <ReplyForm threadId={threadId} lastPage={lastPage(thread.total + 1, thread.pageSize)} />
    </ThreadBody>
  );
}

export { ThreadPage };
