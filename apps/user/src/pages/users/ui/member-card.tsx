import type { ReactElement } from "react";

import type { Members } from "#pages/users/api/load-members.ts";
import { Avatar, CardLink } from "@repo/ui";

import { MemberSummary } from "./member-summary.tsx";

function MemberCard({ member }: Readonly<{ member: Members["members"][number] }>): ReactElement {
  return (
    <li>
      <CardLink to="/users/$id" params={{ id: member.id }}>
        <Avatar name={member.name} />
        <MemberSummary name={member.name} profile={member.profile} />
      </CardLink>
    </li>
  );
}

export { MemberCard };
