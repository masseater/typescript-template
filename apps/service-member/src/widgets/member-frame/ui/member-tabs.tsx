import { memberNavItems } from "../model/navigation.ts";
import { MemberNavItemLink } from "./member-nav-item.tsx";

import type { ReactElement } from "react";

function MemberTabs({
  memberBoard,
  profileId,
}: Readonly<{ memberBoard: boolean; profileId: string }>): ReactElement {
  const items = memberNavItems(memberBoard, profileId);
  return (
    <nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden"
    >
      {items.map((item) => (
        <MemberNavItemLink key={item.id} item={item} layout="tab" />
      ))}
    </nav>
  );
}

export { MemberTabs };
