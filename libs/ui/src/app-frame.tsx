import { useLocation } from "@tanstack/react-router";

import { FrameBrand } from "./app-frame/frame-brand.tsx";
import { FrameHeader } from "./app-frame/frame-header.tsx";
import { FrameNavigation } from "./app-frame/frame-navigation.tsx";
import { FrameTabs } from "./app-frame/frame-tabs.tsx";
import { useCollapsed, usePathAwareNavigation } from "./app-frame/hooks.ts";
import { contentClass, readableCollapsedMark, sidebarClass } from "./app-frame/utils.ts";

import type { ReactElement } from "react";
import type { AppFrameSection } from "./app-frame/types.ts";
import type { UiNode } from "./shared/ui/types.ts";

const AppFrame = ({
  bottomTabs = false,
  children,
  collapsedMark,
  defaultCollapsed = false,
  density = "regular",
  footer,
  headerActions,
  headerLeading,
  homeTo,
  navigationId,
  productName,
  sections,
  subtitle,
  title,
}: Readonly<{
  bottomTabs?: boolean;
  children: UiNode;
  collapsedMark: string;
  defaultCollapsed?: boolean;
  density?: "compact" | "regular";
  footer: (frame: Readonly<{ collapsed: boolean }>) => ReactElement;
  headerActions?: UiNode;
  headerLeading?: UiNode;
  homeTo?: string;
  navigationId: string;
  productName: string;
  sections: readonly AppFrameSection[];
  subtitle?: string;
  title: string;
}>): ReactElement => {
  const { pathname } = useLocation();
  const [navigationOpen, setNavigationOpen] = usePathAwareNavigation(pathname);
  const [collapsed, setCollapsed] = useCollapsed(defaultCollapsed);
  const mark = readableCollapsedMark(collapsedMark);
  const compact = density === "compact";
  const toggleNavigation = (): void => {
    setNavigationOpen((open) => !open);
  };
  const toggleCollapsed = (): void => {
    setCollapsed((collapsedNow) => !collapsedNow);
  };
  return (
    <div className="flex min-h-dvh bg-muted">
      <aside className={sidebarClass({ collapsed, compact, navigationOpen })}>
        <FrameBrand
          collapsed={collapsed}
          compact={compact}
          homeTo={homeTo}
          mark={mark}
          productName={productName}
          subtitle={subtitle}
        />
        <FrameNavigation
          collapsed={collapsed}
          compact={compact}
          navigationId={navigationId}
          sections={sections}
        />
        <div className="mt-auto border-t border-border p-2">{footer({ collapsed })}</div>
      </aside>
      {navigationOpen ? (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="fixed inset-0 z-10 bg-foreground/20 md:hidden"
          onClick={() => {
            setNavigationOpen(false);
          }}
        />
      ) : null}
      <div className={contentClass(bottomTabs)}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <FrameHeader
            collapsed={collapsed}
            compact={compact}
            headerActions={headerActions}
            headerLeading={headerLeading}
            navigationId={navigationId}
            navigationOpen={navigationOpen}
            productName={productName}
            title={title}
            onToggleCollapsed={toggleCollapsed}
            onToggleNavigation={toggleNavigation}
          />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>
      {bottomTabs ? (
        <FrameTabs destinations={sections.flatMap((section) => section.destinations)} />
      ) : null}
    </div>
  );
};

export { AppFrame };
