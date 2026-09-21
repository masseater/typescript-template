import { Icon } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";
import { MenuIcon, PanelLeftIcon } from "lucide-react";

import { adminPageTitles, adminProductName } from "./admin-nav.ts";

import type { ReactElement } from "react";

function AdminHeader({
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
  const title = pathname.startsWith("/members/")
    ? "利用者の詳細"
    : pathname in adminPageTitles
      ? adminPageTitles[pathname as keyof typeof adminPageTitles]
      : adminProductName;
  return (
    <header className="flex items-center gap-2 border-b border-border px-4 py-2">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={navigationOpen}
        aria-controls="admin-navigation"
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
    </header>
  );
}

export { AdminHeader };
