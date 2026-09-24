import { Button, ButtonLink } from "@repo/ui";

import { ProfileShare } from "./profile-share.tsx";

import type { ReactElement } from "react";

type ActionProgress = Readonly<{ blocked: boolean; error: string | undefined }>;

function ActionError({ error }: Readonly<{ error: string | undefined }>): ReactElement | undefined {
  if (error === undefined) {
    return undefined;
  }
  return <p className="text-sm text-destructive">{error}</p>;
}

function OwnActions({ memberId }: Readonly<{ memberId: string }>): ReactElement {
  return (
    <>
      <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
      <ProfileShare memberId={memberId} privateProfile={false} />
    </>
  );
}

function BlockedActions({
  block,
  onToggleBlock,
}: Readonly<{ block: ActionProgress; onToggleBlock: () => void }>): ReactElement {
  return (
    <>
      <Button disabled={block.blocked} onClick={onToggleBlock} type="button" variant="secondary">
        ブロックを解除
      </Button>
      <ActionError error={block.error} />
    </>
  );
}

function PeerActions({
  block,
  follow,
  following,
  memberId,
  onToggleBlock,
  onToggleFollow,
}: Readonly<{
  block: ActionProgress;
  follow: ActionProgress;
  following: boolean;
  memberId: string;
  onToggleBlock: () => void;
  onToggleFollow: () => void;
}>): ReactElement {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={follow.blocked}
          onClick={onToggleFollow}
          type="button"
          variant="secondary"
        >
          {following ? "フォロー中" : "フォロー"}
        </Button>
        <ButtonLink to="/messages/new" search={{ peer: memberId }} variant="secondary">
          メッセージを送る
        </ButtonLink>
        <Button disabled={block.blocked} onClick={onToggleBlock} type="button" variant="secondary">
          ブロック
        </Button>
      </div>
      <ActionError error={follow.error} />
      <ActionError error={block.error} />
    </>
  );
}

function ProfileActions({
  block,
  blocked,
  follow,
  following,
  memberId,
  onToggleBlock,
  onToggleFollow,
  own,
}: Readonly<{
  block: ActionProgress;
  blocked: boolean;
  follow: ActionProgress;
  following: boolean;
  memberId: string;
  onToggleBlock: () => void;
  onToggleFollow: () => void;
  own: boolean;
}>): ReactElement {
  if (own) {
    return <OwnActions memberId={memberId} />;
  }
  if (blocked) {
    return <BlockedActions block={block} onToggleBlock={onToggleBlock} />;
  }
  return (
    <PeerActions
      block={block}
      follow={follow}
      following={following}
      memberId={memberId}
      onToggleBlock={onToggleBlock}
      onToggleFollow={onToggleFollow}
    />
  );
}

export { ProfileActions };
