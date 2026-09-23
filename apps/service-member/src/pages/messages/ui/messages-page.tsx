import { ButtonLink, PageNavigation, TextLink } from "@repo/ui";

import { ConversationRow } from "./conversation-row.tsx";
import { CreateGroupForm } from "./create-group-form.tsx";
import { MessagesBody } from "./messages-body.tsx";
import { MessagesPageLink } from "./messages-page-link.tsx";

import type { ConversationListView } from "#pages/messages/api/messages.ts";
import type { MessagesSearch } from "#pages/messages/model/messages-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function pageLink(target: PageTarget): ReactElement {
  return <MessagesPageLink target={target} />;
}

function MessagesPage({
  list,
  search,
}: Readonly<{ list: ConversationListView; search: MessagesSearch }>): ReactElement {
  const page = search.page ?? 1;
  return (
    <MessagesBody>
      {search.newGroup === true ? (
        <CreateGroupForm />
      ) : (
        <div>
          <ButtonLink to="/messages" search={{ newGroup: true }} variant="primary">
            新しいグループ
          </ButtonLink>
        </div>
      )}
      {list.total === 0 && search.newGroup !== true ? (
        <p className="text-base leading-normal">まだメッセージはありません。</p>
      ) : (
        <>
          {list.conversations.length > 0 && (
            <ul className="flex flex-col gap-3">
              {list.conversations.map((conversation) => (
                <ConversationRow key={conversation.id} conversation={conversation} />
              ))}
            </ul>
          )}
          {list.total > list.pageSize && (
            <PageNavigation
              current={page}
              last={Math.ceil(list.total / list.pageSize)}
              renderLink={pageLink}
            />
          )}
          {list.total > 0 && list.conversations.length === 0 && (
            <p className="text-base leading-normal">
              このページに会話はありません。
              <TextLink to="/messages" search={{}}>
                1 ページ目へ
              </TextLink>
            </p>
          )}
        </>
      )}
    </MessagesBody>
  );
}

export { MessagesPage };
