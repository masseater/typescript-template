import { Heading, PageNavigation, TextLink } from "@repo/ui";

import { ConversationBody } from "./conversation-body.tsx";
import { ConversationPageLink } from "./conversation-page-link.tsx";
import { MessageBubble } from "./message-bubble.tsx";
import { ReplyForm } from "./reply-form.tsx";

import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ConversationSearch } from "#pages/messages/model/messages-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function ConversationPage({
  search,
  thread,
}: Readonly<{ search: ConversationSearch; thread: ConversationThread }>): ReactElement {
  const current = search.page ?? 1;
  const last = Math.max(1, Math.ceil(thread.total / thread.pageSize));
  function pageLink(target: PageTarget): ReactElement {
    return <ConversationPageLink target={target} conversationId={thread.conversation.id} />;
  }
  return (
    <ConversationBody>
      <div className="flex flex-col gap-1">
        <Heading as="h2" size="section">
          <TextLink to="/groups/$id" params={{ id: thread.conversation.group.id }}>
            {thread.conversation.group.name}
          </TextLink>
        </Heading>
        <TextLink to="/groups/$id" params={{ id: thread.conversation.group.id }}>
          情報
        </TextLink>
        <TextLink to="/messages" search={{}}>
          一覧へ戻る
        </TextLink>
      </div>
      <ul className="flex flex-col gap-3">
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ul>
      {thread.total > thread.pageSize && (
        <PageNavigation current={current} last={last} renderLink={pageLink} />
      )}
      <ReplyForm conversationId={thread.conversation.id} />
    </ConversationBody>
  );
}

export { ConversationPage };
