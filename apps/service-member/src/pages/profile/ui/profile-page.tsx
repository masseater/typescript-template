import { ButtonLink, formatWarekiMonth } from "@repo/ui";

import { MemberPage } from "#widgets/member-page/index.ts";
import { Biography } from "./biography.tsx";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  return (
    <ProfileBody>
      <MemberPage
        name={member.name}
        nameAs="h1"
        socialLinks={member.socialLinks}
        joinedLabel={`${formatWarekiMonth(member.joined)}に登録`}
        biography={<Biography own={own} text={member.profile} />}
        actions={
          own ? (
            <>
              <ButtonLink to="/settings/profile" variant="primary">
                プロフィールを編集
              </ButtonLink>
              <ProfileShare memberId={member.id} privateProfile={false} />
            </>
          ) : undefined
        }
      />
    </ProfileBody>
  );
}

export { ProfilePage };
