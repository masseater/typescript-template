import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { pendingCountAtom } from "#shared/api/index.ts";
import { adminNavGroups } from "./admin-nav.ts";
import { AdminNavigationItem } from "./admin-navigation-item.tsx";

import type { ReactElement } from "react";

function AdminNavigation({
  collapsed,
  onNavigate,
}: Readonly<{
  collapsed: boolean;
  onNavigate: () => void;
}>): ReactElement {
  const pendingState = useAtomValue(pendingCountAtom);
  const pendingCount = AsyncResult.isSuccess(pendingState) ? pendingState.value : 0;

  return (
    <nav id="admin-navigation" aria-label="メイン" className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-1 flex-col gap-4 p-2">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {collapsed ? null : (
              <p className="px-3 text-sm leading-tight font-bold text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <AdminNavigationItem
                  key={item.to}
                  badge={item.to === "/inquiries" && pendingCount > 0 ? pendingCount : undefined}
                  collapsed={collapsed}
                  icon={item.icon}
                  label={item.label}
                  to={item.to}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export { AdminNavigation };
