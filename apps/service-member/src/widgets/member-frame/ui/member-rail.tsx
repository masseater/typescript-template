import { NavigationLink } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { memberHasPaidPlan, memberNavItems } from "../model/navigation.ts";
import { AccountMenu } from "./account-menu.tsx";
import { MemberNavItemLink } from "./member-nav-item.tsx";

import type { SessionView } from "@repo/auth-ui";
import type { ReactElement } from "react";
import type { NavBadges } from "../model/navigation.ts";

function MemberRail({
  memberBoard,
  navBadges,
  user,
}: Readonly<{
  memberBoard: boolean;
  navBadges?: NavBadges;
  user: SessionView["user"];
}>): ReactElement {
  const items = memberNavItems(memberHasPaidPlan, memberBoard, user.id, navBadges);
  return (
    <aside className="hidden w-32 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="border-b border-border px-2 py-3 text-center">
        <NavigationLink to="/home" variant="brand" className="text-sm leading-tight">
          {serviceName}
        </NavigationLink>
      </div>
      <nav aria-label="メイン" className="flex flex-1 flex-col gap-1 p-1">
        {items.map((item) => (
          <MemberNavItemLink key={item.id} item={item} layout="rail" />
        ))}
      </nav>
      <div className="mt-auto border-t border-border p-2">
        <AccountMenu name={user.name} userId={user.id} compact />
      </div>
    </aside>
  );
}

export { MemberRail };
