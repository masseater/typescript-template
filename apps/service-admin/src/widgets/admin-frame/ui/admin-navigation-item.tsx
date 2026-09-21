import { Icon, NavigationLink } from "@repo/ui";

import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { AdminNavPath } from "./admin-nav.ts";

const activeOptions = { exact: true, includeSearch: false } as const;

function AdminNavigationItem({
  badge,
  collapsed,
  icon,
  label,
  to,
}: Readonly<{
  badge?: number;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  to: AdminNavPath;
}>): ReactElement {
  return (
    <li>
      <NavigationLink to={to} variant="side" activeOptions={activeOptions} title={label}>
        <span className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <Icon icon={icon} />
          {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
          {collapsed || badge === undefined ? null : (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-sm leading-none font-bold text-secondary-foreground">
              {badge}
            </span>
          )}
        </span>
      </NavigationLink>
    </li>
  );
}

export { AdminNavigationItem };
