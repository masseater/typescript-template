import { MemberCard } from "./member-card.tsx";
import { SearchFields } from "./search-fields.tsx";

import type { ReactElement } from "react";

const sampleMember = {
  id: "sample-member",
  name: "山田 花子",
  profile: "週末は本屋めぐり。プロフィールで趣味と近況を書いています。",
} as const;

function MemberSearchStill(): ReactElement {
  return (
    <div
      aria-hidden="true"
      inert
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <SearchFields keyword="花" />
      <ul className="grid grid-cols-1 gap-4">
        <MemberCard member={sampleMember} />
      </ul>
    </div>
  );
}

export { MemberSearchStill };
