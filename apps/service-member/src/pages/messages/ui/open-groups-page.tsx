import { Heading, TextLink } from "@repo/ui";

import type { OpenGroupsView } from "#pages/messages/api/groups.ts";
import type { ReactElement, ReactNode, ReactPortal } from "react";

function GroupsBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
      <Heading as="h1" size="page">
        公開グループ
      </Heading>
      {children}
    </main>
  );
}

function OpenGroupsPage({ list }: Readonly<{ list: OpenGroupsView }>): ReactElement {
  return (
    <GroupsBody>
      {list.groups.length === 0 ? (
        <p className="text-base leading-normal">公開グループはありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.groups.map((group) => (
            <li key={group.id}>
              <TextLink params={{ id: group.id }} to="/groups/$id">
                {group.name}
              </TextLink>
            </li>
          ))}
        </ul>
      )}
    </GroupsBody>
  );
}

export { GroupsBody, OpenGroupsPage };
