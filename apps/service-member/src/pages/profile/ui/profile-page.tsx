import { Button, ButtonLink, localState, useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { followMember, unfollowMember } from "#pages/profile/api/follow.ts";
import { blockMember, unblockMember } from "#shared/api/index.ts";
import { ProfileLayoutRenderer } from "#shared/profile-layout/renderer.tsx";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

const useFollowingOverride = localState<boolean | undefined>(undefined);
const useBlockedOverride = localState<boolean | undefined>(undefined);

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  const router = useRouter();
  const followAction = useAction();
  const blockAction = useAction();
  const [followingOverride, setFollowingOverride] = useFollowingOverride();
  const [blockedOverride, setBlockedOverride] = useBlockedOverride();
  const following = followingOverride ?? member.following ?? false;
  const blocked = blockedOverride ?? member.blocked ?? false;

  const toggleFollow = (): void => {
    followAction.run(() =>
      (following ? unfollowMember(member.id) : followMember(member.id)).then(() => {
        setFollowingOverride(!following);
        return router.invalidate().then(() => undefined);
      }),
    );
  };

  const toggleBlock = (): void => {
    blockAction.run(() =>
      (blocked ? unblockMember(member.id) : blockMember(member.id)).then(() => {
        setBlockedOverride(!blocked);
        if (!blocked) {
          setFollowingOverride(false);
        }
        return router.invalidate().then(() => undefined);
      }),
    );
  };

  const actions = own ? (
    <>
      <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
      <ProfileShare memberId={member.id} privateProfile={false} />
    </>
  ) : blocked ? (
    <>
      <Button
        disabled={blockAction.blocked}
        onClick={toggleBlock}
        type="button"
        variant="secondary"
      >
        ブロックを解除
      </Button>
      {blockAction.error !== undefined && (
        <p className="text-sm text-destructive">{blockAction.error}</p>
      )}
    </>
  ) : (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={followAction.blocked}
          onClick={toggleFollow}
          type="button"
          variant="secondary"
        >
          {following ? "フォロー中" : "フォロー"}
        </Button>
        <ButtonLink to="/messages/new" search={{ peer: member.id }} variant="secondary">
          メッセージを送る
        </ButtonLink>
        <Button
          disabled={blockAction.blocked}
          onClick={toggleBlock}
          type="button"
          variant="secondary"
        >
          ブロック
        </Button>
      </div>
      {followAction.error !== undefined && (
        <p className="text-sm text-destructive">{followAction.error}</p>
      )}
      {blockAction.error !== undefined && (
        <p className="text-sm text-destructive">{blockAction.error}</p>
      )}
    </>
  );

  return (
    <ProfileBody>
      <ProfileLayoutRenderer
        actions={actions}
        layout={member.profileLayout}
        member={member}
        own={own}
        sheet={member.sheet}
      />
    </ProfileBody>
  );
}

export { ProfilePage };
