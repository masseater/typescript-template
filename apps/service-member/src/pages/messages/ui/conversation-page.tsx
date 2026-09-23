import { Heading, PageNavigation, TextLink } from "@repo/ui";

import { lastPage } from "#shared/ui/index.ts";
import { ConversationBody } from "./conversation-body.tsx";
import { ConversationPageLink } from "./conversation-page-link.tsx";
import { MessageBubble } from "./message-bubble.tsx";
import { ReplyForm } from "./reply-form.tsx";

import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ConversationSearch } from "#pages/messages/model/messages-search.ts";
import type { ReactElement } from "react";

type Conversation = ConversationThread["conversation"];

function PeerHeading({
  peer,
}: Readonly<{ peer: Extract<Conversation, { kind: "direct" }>["peer"] }>): ReactElement {
  return (
    <Heading as="h2" size="section">
      {peer.withdrawn || peer.id === null ? (
        peer.name
      ) : (
        <TextLink to="/users/$id" params={{ id: peer.id }}>
          {peer.name}
        </TextLink>
      )}
    </Heading>
  );
}

function GroupHeading({
  group,
}: Readonly<{ group: Extract<Conversation, { kind: "group" }>["group"] }>): ReactElement {
  return (
    <>
      <Heading as="h2" size="section">
        <TextLink to="/groups/$id" params={{ id: group.id }}>
          {group.name}
        </TextLink>
      </Heading>
      <TextLink to="/groups/$id" params={{ id: group.id }}>
        情報
      </TextLink>
    </>
  );
}

function ConversationHeading({
  conversation,
}: Readonly<{ conversation: Conversation }>): ReactElement {
  return conversation.kind === "direct" ? (
    <PeerHeading peer={conversation.peer} />
  ) : (
    <GroupHeading group={conversation.group} />
  );
}

function ConversationPage({
  search,
  thread,
}: Readonly<{ search: ConversationSearch; thread: ConversationThread }>): ReactElement {
  const conversation = thread.conversation;
  return (
    <ConversationBody>
      <div className="flex flex-col gap-1">
        <ConversationHeading conversation={conversation} />
        <TextLink to="/messages" search={{}}>
          一覧へ戻る
        </TextLink>
      </div>
      <ul className="flex flex-col gap-3">
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} kind={conversation.kind} message={message} />
        ))}
      </ul>
      <PageNavigation
        current={search.page ?? 1}
        last={lastPage(thread.total, thread.pageSize)}
        renderLink={(target) => (
          <ConversationPageLink target={target} conversationId={conversation.id} />
        )}
      />
      <ReplyForm conversationId={conversation.id} />
    </ConversationBody>
  );
}

export { ConversationPage };
