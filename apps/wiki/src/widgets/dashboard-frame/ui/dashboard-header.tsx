import { ButtonLink, Icon } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";
import { MenuIcon, PanelLeftIcon, SearchIcon } from "lucide-react";

import { dashboardPageTitles, wikiDocsPath } from "./dashboard-nav.ts";

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
      : "社内ダッシュボード";
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={navigationOpen}
        aria-controls="dashboard-navigation"
        onClick={onToggleNavigation}
        className="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"
      >
        <Icon icon={MenuIcon} />
      </button>
      <button
        type="button"
        aria-label={collapsed ? "サイドバーを開く" : "サイドバーを畳む"}
        aria-pressed={collapsed}
        onClick={onToggleCollapsed}
        className="hidden cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"
      >
        <Icon icon={PanelLeftIcon} />
      </button>
      <nav aria-label="パンくず" className="min-w-0 truncate text-base leading-tight font-bold">
        {title}
      </nav>
      <label className="flex max-w-64 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 text-muted-foreground">
        <Icon icon={SearchIcon} size="small" />
        <input
          type="search"
          placeholder="検索"
          disabled
          className="min-w-0 flex-1 bg-transparent text-base leading-tight text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </label>
      <div className="ml-auto flex items-center gap-3">
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
        >
          Google Analytics
        </a>
        <ButtonLink to={wikiDocsPath} variant="secondary">
          Wiki
        </ButtonLink>
      </div>
    </header>
  );
}

export { DashboardHeader };
