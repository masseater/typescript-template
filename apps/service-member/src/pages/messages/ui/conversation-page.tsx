import { Heading, PageNavigation, STATUS_VARIANT, StatusMessage, TextLink } from "@repo/ui";

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
    return <ConversationPageLink conversationId={thread.conversation.id} target={target} />;
  }
  return (
    <ConversationBody>
      <Heading as="h1" size="page">
        {thread.conversation.peer.name}
      </Heading>
      {thread.conversation.peer.withdrawn ? null : (
        <TextLink to="/users/$id" params={{ id: thread.conversation.peer.id }}>
          プロフィール
        </TextLink>
      )}
      <ul className="flex flex-col gap-3">
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ul>
      <PageNavigation current={current} last={last} renderLink={pageLink} />
      {thread.conversation.blocked ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          ブロック中のためメッセージを送れません。
        </StatusMessage>
      ) : (
        <ReplyForm
          conversationId={thread.conversation.id}
          lastPage={Math.ceil((thread.total + 1) / thread.pageSize)}
        />
      )}
    </ConversationBody>
  );
}

export { ConversationPage };
