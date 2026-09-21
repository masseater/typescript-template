import { ButtonLink, Icon } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";
import { MenuIcon, PanelLeftIcon } from "lucide-react";

import { dashboardPageTitles, dashboardProductName } from "./dashboard-nav.ts";

import type { ReactElement } from "react";

function DashboardHeader({
  collapsed,
  navigationOpen,
  onToggleCollapsed,
  onToggleNavigation,
}: Readonly<{
  collapsed: boolean;
  navigationOpen: boolean;
  onToggleCollapsed: () => void;
  onToggleNavigation: () => void;
}>): ReactElement {
  const { pathname } = useLocation();
  const title =
    pathname in dashboardPageTitles
      ? dashboardPageTitles[pathname as keyof typeof dashboardPageTitles]
      : dashboardProductName;
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={navigationOpen}
        aria-controls="dashboard-navigation"
        onClick={onToggleNavigation}
        className="inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"
      >
        <Icon icon={MenuIcon} />
      </button>
      <button
        type="button"
        aria-label={collapsed ? "サイドバーを開く" : "サイドバーを畳む"}
        aria-pressed={collapsed}
        onClick={onToggleCollapsed}
        className="hidden min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"
      >
        <Icon icon={PanelLeftIcon} />
      </button>
      <nav aria-label="パンくず" className="min-w-0 truncate text-base leading-tight font-bold">
        {title}
      </nav>
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noreferrer"
        className="ml-auto rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
      >
        Google Analytics
      </a>
      <ButtonLink to="/wiki" variant="secondary">
        Wiki
      </ButtonLink>
    </header>
  );
}

export { DashboardHeader };
