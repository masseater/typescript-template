import { PHOTO_SLOT } from "@repo/config";
import {
  Avatar,
  Button,
  ButtonLink,
  Heading,
  formatWarekiMonth,
  localState,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { followMember, unfollowMember } from "#pages/profile/api/follow.ts";
import { blockMember, memberPhotoUrl, unblockMember } from "#shared/api/index.ts";
import { SocialLinks } from "#shared/social-link";
import { Biography } from "./biography.tsx";
import { CompanyPhoto } from "./company-photo.tsx";
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
    followAction.run(async () => {
      if (following) {
        await unfollowMember(member.id);
        setFollowingOverride(false);
      } else {
        await followMember(member.id);
        setFollowingOverride(true);
      }
      await router.invalidate();
    });
  };

  const toggleBlock = (): void => {
    blockAction.run(async () => {
      if (blocked) {
        await unblockMember(member.id);
        setBlockedOverride(false);
      } else {
        await blockMember(member.id);
        setBlockedOverride(true);
        setFollowingOverride(false);
      }
      await router.invalidate();
    });
  };

  return (
    <ProfileBody>
      <div className="flex items-center gap-4">
        <Avatar
          name={member.name}
          size="large"
          src={memberPhotoUrl(member.id, PHOTO_SLOT.face, member.photos.face)}
        />
        <Heading as="h1" size="page">
          {member.name}
        </Heading>
      </div>
      <Biography own={own} text={blocked ? "" : member.profile} />
      {blocked ? null : <CompanyPhoto memberId={member.id} version={member.photos.company} />}
      {blocked ? null : <SocialLinks urls={member.socialLinks} />}
      <p className="text-sm leading-normal text-muted-foreground">
        {formatWarekiMonth(member.joined)}に登録
      </p>
      {own && (
        <>
          <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
          <ProfileShare memberId={member.id} privateProfile={false} />
        </>
      )}
      {!own && !blocked && (
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
      )}
      {!own && blocked && (
        <Button
          disabled={blockAction.blocked}
          onClick={toggleBlock}
          type="button"
          variant="secondary"
        >
          ブロックを解除
        </Button>
      )}
      {followAction.error !== undefined && (
        <p className="text-sm text-destructive">{followAction.error}</p>
      )}
      {blockAction.error !== undefined && (
        <p className="text-sm text-destructive">{blockAction.error}</p>
      )}
    </ProfileBody>
  );
}

export { ProfilePage };
