import { PHOTO_SLOT } from "@repo/config";
import { Avatar, CardLink } from "@repo/ui";

import { memberPhotoUrl } from "#shared/api/index.ts";
import { MemberSummary } from "./member-summary.tsx";

import type { Members } from "#pages/users/api/load-members.ts";
import type { ReactElement } from "react";

function MemberCard({ member }: Readonly<{ member: Members["members"][number] }>): ReactElement {
  return (
    <li>
      <CardLink to="/users/$id" params={{ id: member.id }}>
        <Avatar
          name={member.name}
          src={memberPhotoUrl(member.id, PHOTO_SLOT.face, member.photos.face)}
        />
        <MemberSummary name={member.name} profile={member.profile} />
      </CardLink>
    </li>
  );
}

export { MemberCard };
