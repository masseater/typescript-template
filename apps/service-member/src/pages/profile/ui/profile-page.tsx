import { localState, useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { followMember, unfollowMember } from "#pages/profile/api/follow.ts";
import { blockMember, unblockMember } from "#shared/api/index.ts";
import { ProfileLayoutRenderer } from "#shared/profile-layout/index.ts";
import { ProfileActions } from "./profile-actions.tsx";
import { ProfileBody } from "./profile-body.tsx";

import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

const useFollowingOverride = localState<boolean | undefined>(undefined);
const useBlockedOverride = localState<boolean | undefined>(undefined);

function overridden(override: boolean | undefined, stored: boolean | undefined): boolean {
  return override ?? stored ?? false;
}

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  const router = useRouter();
  const followAction = useAction();
  const blockAction = useAction();
  const [followingOverride, setFollowingOverride] = useFollowingOverride();
  const [blockedOverride, setBlockedOverride] = useBlockedOverride();
  const following = overridden(followingOverride, member.following);
  const blocked = overridden(blockedOverride, member.blocked);

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

  const actions = (
    <ProfileActions
      block={blockAction}
      blocked={blocked}
      follow={followAction}
      following={following}
      memberId={member.id}
      onToggleBlock={toggleBlock}
      onToggleFollow={toggleFollow}
      own={own}
    />
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
