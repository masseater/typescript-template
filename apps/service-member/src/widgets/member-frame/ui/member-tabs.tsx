import { memberHasPaidPlan, memberNavItems } from "../model/navigation.ts";
import { MemberNavItemLink } from "./member-nav-item.tsx";

import type { ReactElement } from "react";
import type { NavBadges } from "../model/navigation.ts";

function MemberTabs({
  memberBoard,
  navBadges,
}: Readonly<{ memberBoard: boolean; navBadges: NavBadges }>): ReactElement {
  const items = memberNavItems(memberHasPaidPlan, memberBoard, navBadges);
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
