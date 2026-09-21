import { GROUP_JOIN_POLICY } from "@repo/config";
import { Button, Heading, STATUS_VARIANT, StatusMessage, TextLink } from "@repo/ui";

import { useJoinGroup } from "#pages/messages/model/join-group.ts";

import type { GroupPageView } from "#pages/messages/api/groups.ts";
import type { ReactElement } from "react";

function GroupPage({
  group,
  invite,
}: Readonly<{ group: GroupPageView; invite: string | undefined }>): ReactElement {
  const join = useJoinGroup(group.id, invite);
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
      <Heading as="h1" size="page">
        {group.name}
      </Heading>
      <p className="text-base leading-normal">
        {group.joinPolicy === GROUP_JOIN_POLICY.open ? "誰でも参加" : "招待のみ"}・
        {group.memberCount}人
      </p>
      <p className="text-base leading-normal">作成者 {group.owner.name}</p>
      {group.isMember ? (
        <TextLink params={{ id: group.conversationId }} to="/messages/$id">
          メッセージを開く
        </TextLink>
      ) : (
        <div className="flex flex-col gap-2">
          <Button disabled={join.blocked} onClick={join.handleJoin} type="button" variant="primary">
            参加する
          </Button>
          {join.error !== undefined && (
            <StatusMessage variant={STATUS_VARIANT.failure}>{join.error}</StatusMessage>
          )}
        </div>
      )}
      {group.inviteToken === null ? null : (
        <p className="text-base leading-normal break-all">招待トークン {group.inviteToken}</p>
      )}
      {group.inviteExpired && !group.isMember ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          招待リンクの期限が切れています。
        </StatusMessage>
      ) : null}
      <ul className="flex flex-col gap-2">
        {group.members.map((member) => (
          <li key={member.id}>
            <TextLink params={{ id: member.id }} to="/users/$id">
              {member.name}
            </TextLink>
          </li>
        ))}
      </ul>
    </main>
  );
}

export { GroupPage };
