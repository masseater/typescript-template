import { PageNavigation, TextLink } from "@repo/ui";

import { ComposeForm } from "./compose-form.tsx";
import { ConversationRow } from "./conversation-row.tsx";
import { MessagesBody } from "./messages-body.tsx";
import { MessagesPageLink } from "./messages-page-link.tsx";

import type { ConversationListView } from "#pages/messages/api/messages.ts";
import type { MessagesSearch } from "#pages/messages/model/messages-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function MessagesPage({
  composePeer,
  list,
  search,
}: Readonly<{
  composePeer?: Readonly<{ id: string; name: string }>;
  list: ConversationListView;
  search: MessagesSearch;
}>): ReactElement {
  const page = search.page ?? 1;
  function pageLink(target: PageTarget): ReactElement {
    return <MessagesPageLink peer={search.peer} target={target} />;
  }
  return (
    <MessagesBody>
      {composePeer === undefined ? null : (
        <ComposeForm recipientId={composePeer.id} recipientName={composePeer.name} />
      )}
      {list.total === 0 ? (
        <p className="text-base leading-normal">まだメッセージはありません。</p>
      ) : list.conversations.length === 0 ? (
        <p className="text-base leading-normal">
          このページに会話はありません。
          <TextLink to="/messages" search={{}}>
            1 ページ目へ
          </TextLink>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {list.conversations.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} />
            ))}
          </ul>
          <PageNavigation
            current={page}
            last={Math.ceil(list.total / list.pageSize)}
            renderLink={pageLink}
          />
        </>
      )}
    </MessagesBody>
  );
}

export { MessagesPage };
