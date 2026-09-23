import { MenuIcon, PanelLeftIcon } from "lucide-react";

import { Icon } from "../shared/ui/icon.tsx";
import { iconButtonClass } from "./utils.ts";

import type { ReactElement } from "react";
import type { UiNode } from "../shared/ui/types.ts";

const FrameHeader = ({
  collapsed,
  compact,
  headerActions,
  headerLeading,
  navigationId,
  navigationOpen,
  onToggleCollapsed,
  onToggleNavigation,
  productName,
  title,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  headerActions: UiNode;
  headerLeading: UiNode;
  navigationId: string;
  navigationOpen: boolean;
  onToggleCollapsed: () => void;
  onToggleNavigation: () => void;
  productName: string;
  title: string;
}>): ReactElement => {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {headerLeading === undefined ? null : <div className="md:hidden">{headerLeading}</div>}
      <button
        type="button"
        aria-controls={navigationId}
        aria-expanded={navigationOpen}
        aria-label="メニュー"
        className={`${iconButtonClass} inline-flex md:hidden`}
        onClick={onToggleNavigation}
      >
        <Icon icon={MenuIcon} />
      </button>
      <button
        type="button"
        aria-label={collapsed ? "サイドバーを開く" : "サイドバーを畳む"}
        aria-pressed={collapsed}
        className={`${iconButtonClass} hidden md:inline-flex`}
        onClick={onToggleCollapsed}
      >
        <Icon icon={PanelLeftIcon} />
      </button>
      <div className="min-w-0">
        {compact ? (
          <p className="truncate text-sm leading-tight font-bold md:hidden">{productName}</p>
        ) : null}
        <nav aria-label="パンくず" className="min-w-0 truncate text-base leading-tight font-bold">
          {title}
        </nav>
      </div>
      {headerActions}
    </header>
  );
};

export { FrameHeader };
