import { AccountMenu } from "@repo/auth-ui";
import { useState } from "react";

import { DashboardHeader } from "./dashboard-header.tsx";
import { DashboardNavigation } from "./dashboard-navigation.tsx";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function DashboardFrame({
  children,
  email,
  name,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  email: string;
  name: string;
}>): ReactElement {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
            <p className="text-sm leading-tight font-bold text-foreground">社</p>
          ) : (
            <>
              <p className="text-base leading-tight font-bold text-foreground">
                社内ダッシュボード
              </p>
              <p className="text-sm leading-tight text-muted-foreground">状況と運営</p>
            </>
          )}
        </div>
        <DashboardNavigation collapsed={collapsed} onNavigate={closeNavigation} />
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
          <DashboardHeader
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

export { DashboardFrame };
