import { Avatar, CardLink } from "@repo/ui";

import { MemberSummary } from "./member-summary.tsx";

import type { ReactElement } from "react";

function MemberCard({
  member,
}: Readonly<{
  member: { readonly id: string; readonly name: string; readonly profile: string };
}>): ReactElement {
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
