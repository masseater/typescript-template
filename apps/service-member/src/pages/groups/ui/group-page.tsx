import {
  Button,
  ButtonLink,
  Field,
  FormColumn,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  useToast,
} from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { useCopyInvite, useJoinGroup, useLeaveGroup } from "#pages/groups/model/group-actions.ts";
import { useRenameGroupForm } from "#pages/groups/model/rename-group-form.ts";
import { GroupBody } from "./group-body.tsx";

import type { GroupDetail } from "#pages/groups/api/groups.ts";
import type { GroupsSearch } from "#pages/groups/model/groups-search.ts";
import type { ReactElement } from "react";
function invitePath(groupId: string, token: string): string {
  return `/groups/${groupId}?invite=${token}`;
}
function MemberRow({
  id,
  name,
}: Readonly<{
  id: string;
  name: string;
}>): ReactElement {
  return (
    <li>
      <TextLink
        to="/users/$id"
        params={{
          id,
        }}
      >
        {name}
      </TextLink>
    </li>
  );
}
function GroupPage({
  group,
  search,
}: Readonly<{
  group: GroupDetail;
  search: GroupsSearch;
}>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  const join = useJoinGroup(
    group.id,
    (conversationId) =>
      router.invalidate().then(() =>
        navigate({
          params: {
            id: conversationId,
          },
          to: "/messages/$id",
        }).then(() => notify("success", "グループに参加しました。")),
      ),
    search.invite,
  );
  const leave = useLeaveGroup(group.id, () =>
    router.invalidate().then(() => notify("success", "グループから退席しました。")),
  );
  const copyInvite = useCopyInvite(group.id, (token) => {
    const link = `${globalThis.location.origin}${invitePath(group.id, token)}`;
    void navigator.clipboard.writeText(link);
    notify("success", "招待リンクをコピーしました。");
  });
  const rename = useRenameGroupForm(group.id, group.name, () =>
    router.invalidate().then(() => notify("success", "グループ名を変更しました。")),
  );
  const inviteExpired = group.inviteExpired && !group.isMember;
  return (
    <GroupBody>
      <div className="flex flex-col gap-6">
        <Heading as="h1" size="page">
          {group.name}
        </Heading>
        <p className="text-base leading-normal">
          所有者:{" "}
          <TextLink
            to="/users/$id"
            params={{
              id: group.owner.id,
            }}
          >
            {group.owner.name}
          </TextLink>
        </p>
        <p className="text-base leading-normal">メンバー {group.memberCount} 人</p>
        <div className="flex flex-wrap gap-3">
          {!group.isMember && !inviteExpired && (
            <Button
              type="button"
              variant="primary"
              disabled={join.pending}
              onClick={join.handleJoin}
            >
              参加する
            </Button>
          )}
          {inviteExpired && (
            <StatusMessage variant={STATUS_VARIANT.failure}>
              招待リンクの期限が切れています。
            </StatusMessage>
          )}
          {group.isMember && (
            <>
              <ButtonLink
                to="/messages/$id"
                params={{
                  id: group.conversationId,
                }}
                variant="primary"
              >
                会話を開く
              </ButtonLink>
              <Button
                type="button"
                disabled={copyInvite.pending}
                onClick={copyInvite.handleCopyInvite}
              >
                招待リンクをコピー
              </Button>
              {!group.isOwner && (
                <Button type="button" disabled={leave.pending} onClick={leave.handleLeave}>
                  退席する
                </Button>
              )}
            </>
          )}
        </div>
        {group.isOwner && (
          <form onSubmit={rename.handleSubmit} aria-busy={rename.pending}>
            <FormColumn>
              <Heading as="h2" size="section">
                グループ名を変更
              </Heading>
              <Field
                label="グループ名"
                name="name"
                maxLength={100}
                value={rename.name}
                onValueChange={rename.handleNameChange}
              />
              <Button type="submit" variant="primary" disabled={rename.blocked}>
                保存する
              </Button>
              {rename.error !== undefined && (
                <StatusMessage variant={STATUS_VARIANT.failure}>{rename.error}</StatusMessage>
              )}
            </FormColumn>
          </form>
        )}
        {group.members.length > 0 && (
          <section aria-labelledby="group-members-heading">
            <Heading as="h2" size="section">
              <span id="group-members-heading">メンバー</span>
            </Heading>
            <ul className="flex flex-col gap-2">
              {group.members.map((member) => (
                <MemberRow key={member.id} id={member.id} name={member.name} />
              ))}
            </ul>
          </section>
        )}
        {join.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{join.error}</StatusMessage>
        )}
        {leave.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{leave.error}</StatusMessage>
        )}
        {copyInvite.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{copyInvite.error}</StatusMessage>
        )}
      </div>
    </GroupBody>
  );
}
export { GroupPage };
