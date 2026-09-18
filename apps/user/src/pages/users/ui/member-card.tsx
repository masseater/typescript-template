import { Avatar, CardLink } from "@template/ui";
import type { Member } from "#pages/users/api/members-api.ts";
import { MemberSummary } from "./member-summary.tsx";
import type { ReactElement } from "react";
import { useEditedProfile } from "#entities/profile/index.ts";

function MemberCard({
  index,
  measure,
  member,
  offset,
}: Readonly<{
  index: number;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  measure: (node: Element | null) => void;
  member: Member | undefined;
  offset: number;
}>): ReactElement {
  const edited = useEditedProfile(member?.id ?? "");
  return (
    <li
      ref={measure}
      data-index={index}
      className="absolute top-0 left-0 w-full"
      style={{ transform: `translateY(${offset}px)` }}
    >
      {member !== undefined && (
        <CardLink to="/users/$id" params={{ id: member.id }}>
          <Avatar name={edited?.name ?? member.name} />
          <MemberSummary
            name={edited?.name ?? member.name}
            profile={edited?.profile ?? member.profile}
          />
        </CardLink>
      )}
    </li>
  );
}

export { MemberCard };
