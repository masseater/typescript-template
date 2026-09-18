import { Avatar, CardLink } from "@template/ui";
import type { Member } from "#entities/member/index.ts";
import { MemberSummary } from "./member-summary.tsx";
import type { ReactElement } from "react";
import { useEditedProfile } from "#entities/profile/index.ts";

function MemberCard({ member }: Readonly<{ member: Member }>): ReactElement {
  const edited = useEditedProfile(member.id);
  return (
    <CardLink to="/users/$id" params={{ id: member.id }}>
      <Avatar name={edited?.name ?? member.name} />
      <MemberSummary
        name={edited?.name ?? member.name}
        profile={edited?.profile ?? member.profile}
      />
    </CardLink>
  );
}

export { MemberCard };
