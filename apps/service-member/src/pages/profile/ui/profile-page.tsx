import { Button, ButtonLink, localState, useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { followMember, unfollowMember } from "#pages/profile/api/follow.ts";
import { ProfileLayoutRenderer } from "#shared/profile-layout/index.ts";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

const useFollowingOverride = localState<boolean | undefined>(undefined);

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  const router = useRouter();
  const followAction = useAction();
  const [followingOverride, setFollowingOverride] = useFollowingOverride();
  const following = followingOverride ?? member.following ?? false;

  const toggleFollow = (): void => {
    followAction.run(() => {
      const next = following
        ? unfollowMember(member.id).then(() => {
            setFollowingOverride(false);
          })
        : followMember(member.id).then(() => {
            setFollowingOverride(true);
          });
      return next.then(() => router.invalidate());
    });
  };

  const actions = own ? (
    <>
      <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
      <ProfileShare memberId={member.id} privateProfile={false} />
    </>
  ) : (
    <>
      <Button
        disabled={followAction.blocked}
        onClick={toggleFollow}
        type="button"
        variant="secondary"
      >
        {following ? "フォロー中" : "フォロー"}
      </Button>
      <ButtonLink to="/upgrade" variant="secondary">
        メッセージを送る
      </ButtonLink>
      {followAction.error !== undefined && (
        <p className="text-sm text-destructive">{followAction.error}</p>
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
