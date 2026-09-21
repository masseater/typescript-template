import { useAtom } from "@effect/atom-react";
import { useLocation } from "@tanstack/react-router";
import { Atom } from "effect/unstable/reactivity";
import { MenuIcon, PanelLeftIcon } from "lucide-react";
import { useId, type ReactElement } from "react";

import { localState } from "./local-state.ts";
import { Icon } from "./shared/ui/icon.tsx";
import { NavigationLink } from "./shared/ui/navigation-link.tsx";

import type { UiNode } from "./shared/ui/types.ts";

type AppFrameDestination = Readonly<{
  badge?: number;
  exact?: boolean;
  icon: ReactElement;
  label: string;
  marker?: string;
  to: string;
}>;

type AppFrameSection = Readonly<{
  destinations: readonly AppFrameDestination[];
  label: string;
}>;

const useNavigationOpen = localState(false);

const collapsedAtom = Atom.family((slot: string) => Atom.make(slot.endsWith(":collapsed")));

const trackedPathAtom = Atom.family((slot: string) => {
  void slot;
  return Atom.make("");
});

const graphemeSegmenter = new Intl.Segmenter();

const graphemeCount = (mark: string): number => Array.from(graphemeSegmenter.segment(mark)).length;

const readableCollapsedMark = (mark: string): string => {
  if (graphemeCount(mark) < 2) {
    throw new Error("collapsed mark must be a readable word");
  }
  return mark;
};

const useCollapsed = (
  defaultCollapsed: boolean,
): readonly [boolean, (update: (collapsedNow: boolean) => boolean) => void] => {
  const slot = `${useId()}:${defaultCollapsed ? "collapsed" : "expanded"}`;
  return useAtom(collapsedAtom(slot));
};

const sidebarWidth = (collapsed: boolean, compact: boolean): string => {
  if (collapsed) {
    return "md:w-14";
  }
  if (compact) {
    return "md:w-32";
  }
  return "md:w-56";
};

const overlayWidth = (compact: boolean): string => {
  if (compact) {
    return "w-32";
  }
  return "w-56";
};

const sidebarClass = (
  presentation: Readonly<{ collapsed: boolean; compact: boolean; navigationOpen: boolean }>,
): string => {
  const width = sidebarWidth(presentation.collapsed, presentation.compact);
  if (presentation.navigationOpen) {
    return `flex shrink-0 flex-col border-r border-border bg-card ${width} absolute inset-y-0 left-0 z-20 ${overlayWidth(presentation.compact)} shadow-sm md:static md:shadow-none`;
  }
  return `flex shrink-0 flex-col border-r border-border bg-card ${width} hidden md:flex`;
};

const contentClass = (bottomTabs: boolean): string => {
  if (bottomTabs) {
    return "flex min-w-0 flex-1 flex-col p-2 pb-16 md:p-3";
  }
  return "flex min-w-0 flex-1 flex-col p-2 md:p-3";
};

const FrameBrand = ({
  collapsed,
  compact,
  homeTo,
  mark,
  productName,
  subtitle,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  homeTo: string | undefined;
  mark: string;
  productName: string;
  subtitle: string | undefined;
}>): ReactElement => {
  if (collapsed) {
    return (
      <div className="border-b border-border px-2 py-3 text-center">
        <p className="text-sm leading-tight font-bold text-foreground">
          <span className="sr-only">{productName}</span>
          <span aria-hidden="true">{mark}</span>
        </p>
      </div>
    );
  }
  const productClass = compact
    ? "text-sm leading-tight font-bold text-foreground"
    : "text-base leading-tight font-bold text-foreground";
  return (
    <div className={`border-b border-border py-3 ${compact ? "px-2 text-center" : "px-3"}`}>
      {homeTo === undefined || compact ? (
        <p className={productClass}>{productName}</p>
      ) : (
        <NavigationLink to={homeTo} variant="brand">
          {productName}
        </NavigationLink>
      )}
      {subtitle === undefined ? null : (
        <p className="text-sm leading-tight text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
};

const DestinationText = ({
  collapsed,
  compact,
  destination,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  destination: Readonly<AppFrameDestination>;
}>): ReactElement | null => {
  if (collapsed) {
    return null;
  }
  if (compact) {
    return (
      <span className="flex items-center justify-center gap-1 text-sm leading-none">
        <span>{destination.label}</span>
        {destination.marker === undefined ? null : (
          <span className="font-bold text-muted-foreground">{destination.marker}</span>
        )}
      </span>
    );
  }
  return <span className="min-w-0 flex-1 truncate">{destination.label}</span>;
};

const rowClass = (collapsed: boolean, compact: boolean): string => {
  if (compact) {
    return "flex flex-col items-center gap-1";
  }
  if (collapsed) {
    return "flex items-center justify-center gap-2";
  }
  return "flex items-center gap-2";
};

const accessibleLabel = (destination: Readonly<AppFrameDestination>): string => {
  if (destination.marker === undefined) {
    return destination.label;
  }
  return `${destination.label}（${destination.marker}）`;
};

const DestinationBadge = ({
  badge,
  compact,
}: Readonly<{ badge: number | undefined; compact: boolean }>): ReactElement | null => {
  if (badge === undefined || badge === 0) {
    return null;
  }
  if (compact) {
    return (
      <span className="absolute -top-1 -right-2 rounded-full bg-secondary px-1 text-sm leading-none font-bold text-secondary-foreground">
        {badge}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-sm leading-none font-bold text-secondary-foreground">
      {badge}
    </span>
  );
};

const FrameDestination = ({
  collapsed,
  compact,
  destination,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  destination: Readonly<AppFrameDestination>;
}>): ReactElement => {
  const destinationLabel = accessibleLabel(destination);
  return (
    <li>
      <NavigationLink
        activeOptions={{ exact: destination.exact ?? true, includeSearch: false }}
        aria-label={destinationLabel}
        title={destinationLabel}
        to={destination.to}
        variant="side"
      >
        <span className={rowClass(collapsed, compact)}>
          <span className="relative">
            {destination.icon}
            {compact ? <DestinationBadge badge={destination.badge} compact /> : null}
          </span>
          <DestinationText collapsed={collapsed} compact={compact} destination={destination} />
          {!compact && !collapsed ? (
            <DestinationBadge badge={destination.badge} compact={false} />
          ) : null}
        </span>
      </NavigationLink>
    </li>
  );
};

const sectionKey = (section: Readonly<AppFrameSection>): string => {
  return `${section.label}:${section.destinations.map((destination) => destination.to).join(",")}`;
};

const FrameNavigation = ({
  collapsed,
  compact,
  navigationId,
  sections,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  navigationId: string;
  sections: readonly AppFrameSection[];
}>): ReactElement => {
  return (
    <nav
      aria-label="メイン"
      className={
        compact
          ? "flex flex-1 flex-col gap-1 overflow-y-auto p-1"
          : "flex flex-1 flex-col overflow-y-auto"
      }
      id={navigationId}
    >
      <div className={compact ? "flex flex-1 flex-col gap-1" : "flex flex-1 flex-col gap-4 p-2"}>
        {sections.map((section) => (
          <div key={sectionKey(section)} className="flex flex-col gap-1">
            {collapsed || compact || section.label === "" ? null : (
              <p className="px-3 text-sm leading-tight font-bold text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {section.destinations.map((destination) => (
                <FrameDestination
                  key={destination.to}
                  collapsed={collapsed}
                  compact={compact}
                  destination={destination}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};

const FrameTab = ({
  destination,
}: Readonly<{ destination: Readonly<AppFrameDestination> }>): ReactElement => {
  const destinationLabel = accessibleLabel(destination);
  return (
    <div className="flex-1">
      <NavigationLink
        activeOptions={{ exact: destination.exact ?? true, includeSearch: false }}
        aria-label={destinationLabel}
        title={destinationLabel}
        to={destination.to}
        variant="side"
      >
        <span className="flex flex-col items-center gap-1">
          <span className="relative">
            {destination.icon}
            <DestinationBadge badge={destination.badge} compact />
          </span>
          {destination.marker === undefined ? null : (
            <span className="text-sm leading-none font-bold text-muted-foreground">
              {destination.marker}
            </span>
          )}
        </span>
      </NavigationLink>
    </div>
  );
};

const FrameTabs = ({
  destinations,
}: Readonly<{ destinations: readonly AppFrameDestination[] }>): ReactElement => {
  return (
    <nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden"
    >
      {destinations.map((destination) => (
        <FrameTab key={destination.to} destination={destination} />
      ))}
    </nav>
  );
};

const iconButtonClass =
  "min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator";

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

const useTrackedPath = (): readonly [string, (path: string) => void] => {
  return useAtom(trackedPathAtom(useId()));
};

const usePathAwareNavigation = (
  pathname: string,
): readonly [boolean, (update: boolean | ((open: boolean) => boolean)) => void] => {
  const [navigationOpen, setNavigationOpen] = useNavigationOpen();
  const [trackedPath, setTrackedPath] = useTrackedPath();
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    setNavigationOpen(false);
  }
  return [navigationOpen, setNavigationOpen];
};

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
