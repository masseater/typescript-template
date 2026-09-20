import { ButtonLink } from "@repo/ui";

import { ProfileLayoutRenderer } from "#shared/profile-layout/index.ts";
import { ProfileBody } from "./profile-body.tsx";
import { ProfileShare } from "./profile-share.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  const actions =
    own === false ? undefined : (
      <>
        <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>
        <ProfileShare memberId={member.id} privateProfile={false} />
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
