import { ButtonLink, PageNavigation, TextLink } from "@repo/ui";

import { lastPage } from "#shared/ui/index.ts";
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

function NewGroupEntry({ open }: Readonly<{ open: boolean }>): ReactElement {
  if (open) {
    return <CreateGroupForm />;
  }
  return (
    <div>
      <ButtonLink to="/messages" search={{ newGroup: true }} variant="primary">
        新しいグループ
      </ButtonLink>
    </div>
  );
}

function PastEndNotice({
  list,
}: Readonly<{ list: ConversationListView }>): ReactElement | undefined {
  if (list.total > 0 && list.conversations.length === 0) {
    return (
      <p className="text-base leading-normal">
        このページに会話はありません。
        <TextLink to="/messages" search={{}}>
          1 ページ目へ
        </TextLink>
      </p>
    );
  }
  return undefined;
}

function Conversations({
  list,
  page,
}: Readonly<{ list: ConversationListView; page: number }>): ReactElement {
  return (
    <>
      {list.conversations.length > 0 && (
        <ul className="flex flex-col gap-3">
          {list.conversations.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
        </ul>
      )}
      <PageNavigation
        current={page}
        last={lastPage(list.total, list.pageSize)}
        renderLink={pageLink}
      />
      <PastEndNotice list={list} />
    </>
  );
}

function MessagesPage({
  list,
  search,
}: Readonly<{ list: ConversationListView; search: MessagesSearch }>): ReactElement {
  const newGroup = search.newGroup === true;
  return (
    <MessagesBody>
      <NewGroupEntry open={newGroup} />
      {list.total === 0 && !newGroup ? (
        <p className="text-base leading-normal">まだメッセージはありません。</p>
      ) : (
        <Conversations list={list} page={search.page ?? 1} />
      )}
    </MessagesBody>
  );
}

export { MessagesPage };
