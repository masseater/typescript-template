import { Avatar, CardLink } from "@template/ui/ui";
import { MemberSummary } from "./member-summary.tsx";
import type { Members } from "#pages/users/api/load-members.ts";
import type { ReactElement } from "react";

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
