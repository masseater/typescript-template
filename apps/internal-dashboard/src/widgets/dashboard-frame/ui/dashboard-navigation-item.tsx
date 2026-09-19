import { Icon, NavigationLink } from "@repo/ui";

import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { DashboardNavPath } from "./dashboard-nav.ts";

const activeOptions = { exact: true, includeSearch: false } as const;

function DashboardNavigationItem({
  collapsed,
  icon,
  label,
  onNavigate,
  to,
}: Readonly<{
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onNavigate: () => void;
  to: DashboardNavPath;
}>): ReactElement {
  return (
    <li>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <NavigationLink
        to={to}
        variant="side"
        activeOptions={activeOptions}
        title={label}
        onClick={onNavigate}
      >
        <span className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <Icon icon={icon} />
          {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
        </span>
      </NavigationLink>
    </li>
  );
}

export { DashboardNavigationItem };
