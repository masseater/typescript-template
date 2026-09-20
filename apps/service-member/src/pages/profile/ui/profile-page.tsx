import { Avatar, ButtonLink, Heading } from "@repo/ui";

import { SocialLinks } from "#shared/social-link";
import { Biography } from "./biography.tsx";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

const joinedMonth = new Intl.DateTimeFormat("ja", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
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
        {joinedMonth.format(new Date(`${member.joined}-01T00:00:00Z`))}に登録
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
