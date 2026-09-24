import {
  Button,
  ButtonLink,
  Field,
  FormColumn,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
} from "@repo/ui";

import { ActionFailure } from "#shared/ui/index.ts";
import { GroupBody } from "./group-body.tsx";

import type { GroupView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

type Group = typeof GroupView.Type;

type ActionProgress = Readonly<{ error: string | undefined; pending: boolean }>;

type RenameProgress = Readonly<{
  blocked: boolean;
  error: string | undefined;
  name: string;
  pending: boolean;
}>;

type SubmitHandler = (event: Readonly<{ preventDefault: () => void }>) => void;

function MemberRow({ id, name }: Readonly<{ id: string; name: string }>): ReactElement {
  return (
    <li>
      <TextLink to="/users/$id" params={{ id }}>
        {name}
      </TextLink>
    </li>
  );
}

function MemberActions({
  copyInvite,
  group,
  leave,
  onCopyInvite,
  onLeave,
}: Readonly<{
  copyInvite: ActionProgress;
  group: Group;
  leave: ActionProgress;
  onCopyInvite: () => void;
  onLeave: () => void;
}>): ReactElement {
  return (
    <>
      <ButtonLink to="/messages/$id" params={{ id: group.conversationId }} variant="primary">
        会話を開く
      </ButtonLink>
      <Button type="button" disabled={copyInvite.pending} onClick={onCopyInvite}>
        招待リンクをコピー
      </Button>
      {!group.isOwner && (
        <Button type="button" disabled={leave.pending} onClick={onLeave}>
          退席する
        </Button>
      )}
    </>
  );
}

function MembershipActions({
  copyInvite,
  group,
  join,
  leave,
  onCopyInvite,
  onJoin,
  onLeave,
}: Readonly<{
  copyInvite: ActionProgress;
  group: Group;
  join: ActionProgress;
  leave: ActionProgress;
  onCopyInvite: () => void;
  onJoin: () => void;
  onLeave: () => void;
}>): ReactElement {
  if (group.isMember) {
    return (
      <MemberActions
        copyInvite={copyInvite}
        group={group}
        leave={leave}
        onCopyInvite={onCopyInvite}
        onLeave={onLeave}
      />
    );
  }
  if (group.inviteExpired) {
    return (
      <StatusMessage variant={STATUS_VARIANT.failure}>
        招待リンクの期限が切れています。
      </StatusMessage>
    );
  }
  return (
    <Button type="button" variant="primary" disabled={join.pending} onClick={onJoin}>
      参加する
    </Button>
  );
}

function RenameSection({
  onNameChange,
  onRename,
  rename,
}: Readonly<{
  onNameChange: (value: string) => void;
  onRename: SubmitHandler;
  rename: RenameProgress;
}>): ReactElement {
  return (
    <form onSubmit={onRename} aria-busy={rename.pending}>
      <FormColumn>
        <Heading as="h2" size="section">
          グループ名を変更
        </Heading>
        <Field
          label="グループ名"
          name="name"
          maxLength={100}
          value={rename.name}
          onValueChange={onNameChange}
        />
        <Button type="submit" variant="primary" disabled={rename.blocked}>
          保存する
        </Button>
        <ActionFailure error={rename.error} />
      </FormColumn>
    </form>
  );
}

function GroupMembers({
  members,
}: Readonly<{ members: Group["members"] }>): ReactElement | undefined {
  if (members.length === 0) {
    return undefined;
  }
  return (
    <section aria-labelledby="group-members-heading">
      <Heading as="h2" size="section">
        <span id="group-members-heading">メンバー</span>
      </Heading>
      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow key={member.id} id={member.id} name={member.name} />
        ))}
      </ul>
    </section>
  );
}

function GroupPanel({
  copyInvite,
  group,
  join,
  leave,
  onCopyInvite,
  onJoin,
  onLeave,
  onNameChange,
  onRename,
  rename,
}: Readonly<{
  copyInvite: ActionProgress;
  group: Group;
  join: ActionProgress;
  leave: ActionProgress;
  onCopyInvite: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onNameChange: (value: string) => void;
  onRename: SubmitHandler;
  rename: RenameProgress;
}>): ReactElement {
  return (
    <GroupBody>
      <div className="flex flex-col gap-6">
        <Heading as="h1" size="page">
          {group.name}
        </Heading>
        <p className="text-base leading-normal">
          所有者:{" "}
          <TextLink to="/users/$id" params={{ id: group.owner.id }}>
            {group.owner.name}
          </TextLink>
        </p>
        <p className="text-base leading-normal">メンバー {group.memberCount} 人</p>
        <div className="flex flex-wrap gap-3">
          <MembershipActions
            copyInvite={copyInvite}
            group={group}
            join={join}
            leave={leave}
            onCopyInvite={onCopyInvite}
            onJoin={onJoin}
            onLeave={onLeave}
          />
        </div>
        {group.isOwner && (
          <RenameSection onNameChange={onNameChange} onRename={onRename} rename={rename} />
        )}
        <GroupMembers members={group.members} />
        <ActionFailure error={join.error} />
        <ActionFailure error={leave.error} />
        <ActionFailure error={copyInvite.error} />
      </div>
    </GroupBody>
  );
}

export { GroupPanel };
