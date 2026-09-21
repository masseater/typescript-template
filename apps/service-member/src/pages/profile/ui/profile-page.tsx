import { PHOTO_SLOT } from "@repo/config";
import { Avatar, ButtonLink, Heading, formatWarekiMonth } from "@repo/ui";

import { memberPhotoUrl } from "#shared/api/index.ts";
import { SocialLinks } from "#shared/social-link";
import { Biography } from "./biography.tsx";
import { CompanyPhoto } from "./company-photo.tsx";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
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
      <Biography own={own} text={member.profile} />
      <CompanyPhoto memberId={member.id} version={member.photos.company} />
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
    </ProfileBody>
  );
}

export { ProfilePage };
