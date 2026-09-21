import { AccountMenu } from "@repo/auth-ui";
import { localState } from "@repo/ui";
import { useState } from "react";

import { AdminHeader } from "./admin-header.tsx";
import { adminProductName, collapsedAdminMark } from "./admin-nav.ts";
import { AdminNavigation } from "./admin-navigation.tsx";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const useNavigationOpen = localState(false);

function AdminFrame({
  children,
  defaultCollapsed = false,
  email,
  name,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  defaultCollapsed?: boolean;
  email: string;
  name: string;
}>): ReactElement {
  const [navigationOpen, setNavigationOpen] = useNavigationOpen();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  function toggleNavigation(): void {
    setNavigationOpen((open) => !open);
  }
  function closeNavigation(): void {
    setNavigationOpen(false);
  }
  function toggleCollapsed(): void {
    setCollapsed((value) => !value);
  }
  return (
    <div className="flex min-h-dvh bg-muted">
      <aside
        className={`flex shrink-0 flex-col border-r border-border bg-card ${collapsed ? "md:w-14" : "md:w-56"} ${navigationOpen ? "absolute inset-y-0 left-0 z-20 w-56 shadow-sm md:static md:shadow-none" : "hidden md:flex"}`}
      >
        <div className={`border-b border-border py-3 ${collapsed ? "px-2 text-center" : "px-3"}`}>
          {collapsed ? (
            <p className="text-sm leading-tight font-bold text-foreground">
              <span className="sr-only">{adminProductName}</span>
              <span aria-hidden="true">{collapsedAdminMark}</span>
            </p>
          ) : (
            <>
              <p className="text-base leading-tight font-bold text-foreground">
                {adminProductName}
              </p>
              <p className="text-sm leading-tight text-muted-foreground">運用コンソール</p>
            </>
          )}
        </div>
        <AdminNavigation collapsed={collapsed} onNavigate={closeNavigation} />
        <div className="mt-auto border-t border-border p-2">
          <AccountMenu collapsed={collapsed} email={email} name={name} />
        </div>
      </aside>
      {navigationOpen ? (
        <button
          type="button"
          aria-label="メニューを閉じる"
          onClick={closeNavigation}
          className="fixed inset-0 z-10 bg-foreground/20 md:hidden"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col p-2 md:p-3">
        <div className="rounded-xl flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm">
          <AdminHeader
            collapsed={collapsed}
            navigationOpen={navigationOpen}
            onToggleCollapsed={toggleCollapsed}
            onToggleNavigation={toggleNavigation}
          />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

export { AdminFrame };
