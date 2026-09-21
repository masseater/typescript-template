import { useSessionUser } from "@repo/auth-ui";

import { visibleNavGroups } from "./dashboard-nav.ts";
import { DashboardNavigationItem } from "./dashboard-navigation-item.tsx";

import type { ReactElement } from "react";

function DashboardNavigation({
  collapsed,
}: Readonly<{
  collapsed: boolean;
}>): ReactElement {
  const { permission } = useSessionUser();
  return (
    <nav
      id="dashboard-navigation"
      aria-label="メイン"
      className="flex flex-1 flex-col overflow-y-auto"
    >
      <div className="flex flex-1 flex-col gap-4 p-2">
        {visibleNavGroups(permission).map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {collapsed ? null : (
              <p className="px-3 text-sm leading-tight font-bold text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <DashboardNavigationItem
                  key={item.to}
                  collapsed={collapsed}
                  icon={item.icon}
                  label={item.label}
                  to={item.to}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export { DashboardNavigation };
