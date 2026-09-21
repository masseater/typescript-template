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
  onNavigate,
  to,
}: Readonly<{
  badge?: number;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onNavigate: () => void;
  to: AdminNavPath;
}>): ReactElement {
  return (
    <li>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- NavigationLink is the keyboard-reachable link, and this click handler only closes the menu after that link activates */}
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
