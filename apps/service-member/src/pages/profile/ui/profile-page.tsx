import { Avatar, Button, ButtonLink, Heading, formatWarekiMonth, useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { followMember, unfollowMember } from "#pages/profile/api/follow.ts";
import { SocialLinks } from "#shared/social-link";
import { Biography } from "./biography.tsx";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  const router = useRouter();
  const followAction = useAction();
  const [following, setFollowing] = useState(member.following ?? false);

  const toggleFollow = (): void => {
    followAction.run(async () => {
      if (following) {
        await unfollowMember(member.id);
        setFollowing(false);
      } else {
        await followMember(member.id);
        setFollowing(true);
      }
      await router.invalidate();
    });
  };

  return (
    <ProfileBody>
      <div className="flex items-center gap-4">
        <Avatar name={member.name} size="large" />
        <Heading as="h1" size="page">
          {member.name}
        </Heading>
      </div>
      <Biography own={own} text={member.profile} />
      <SocialLinks urls={member.socialLinks} />
      <p className="text-sm leading-normal text-muted-foreground">
        {formatWarekiMonth(member.joined)}に登録
      </p>
      {own && (
        <>
          <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
          <ProfileShare memberId={member.id} privateProfile={false} />
        </>
      )}
      {!own && (
        <div className="flex flex-wrap gap-3">
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
        </div>
      )}
      {followAction.error !== undefined && (
        <p className="text-sm text-destructive">{followAction.error}</p>
      )}
    </ProfileBody>
  );
}

export { ProfilePage };
