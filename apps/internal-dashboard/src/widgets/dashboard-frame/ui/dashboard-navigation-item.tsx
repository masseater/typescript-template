import { Icon, NavigationLink } from "@repo/ui";

import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { DashboardNavPath } from "./dashboard-nav.ts";

const activeOptions = { exact: true, includeSearch: false } as const;

function DashboardNavigationItem({
  collapsed,
  icon,
  label,
  to,
}: Readonly<{
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  to: DashboardNavPath;
}>): ReactElement {
  return (
    <li>
      <NavigationLink to={to} variant="side" activeOptions={activeOptions} title={label}>
        <span className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <Icon icon={icon} />
          {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
        </span>
      </NavigationLink>
    </li>
  );
}

export { DashboardNavigationItem };
