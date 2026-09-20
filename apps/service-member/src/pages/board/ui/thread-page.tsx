import { Heading, PageNavigation } from "@repo/ui";

import { PostItem } from "./post-item.tsx";
import { ReplyForm } from "./reply-form.tsx";
import { ThreadBody } from "./thread-body.tsx";
import { ThreadPageLink } from "./thread-page-link.tsx";

import type { Thread } from "#pages/board/api/board.ts";
import type { ThreadSearch } from "#pages/board/model/board-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function ThreadPage({
  search,
  thread,
}: Readonly<{ search: ThreadSearch; thread: Thread }>): ReactElement {
  const current = search.page ?? 1;
  const last = Math.max(1, Math.ceil(thread.total / thread.pageSize));
  function pageLink(target: PageTarget): ReactElement {
    return <ThreadPageLink target={target} threadId={thread.thread.id} />;
  }
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
      <PageNavigation current={current} last={last} renderLink={pageLink} />
      <ReplyForm
        threadId={thread.thread.id}
        lastPage={Math.ceil((thread.total + 1) / thread.pageSize)}
      />
    </ThreadBody>
  );
}

export { ThreadPage };
