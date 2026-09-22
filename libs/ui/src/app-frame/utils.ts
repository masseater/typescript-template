import type { AppFrameDestination, AppFrameSection } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter();

const graphemeCount = (mark: string): number => Array.from(graphemeSegmenter.segment(mark)).length;

const readableCollapsedMark = (mark: string): string => {
  if (graphemeCount(mark) < 2) {
    throw new Error("collapsed mark must be a readable word");
  }
  return mark;
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

const sectionKey = (section: Readonly<AppFrameSection>): string => {
  return `${section.label}:${section.destinations.map((destination) => destination.to).join(",")}`;
};

const iconButtonClass =
  "min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator";

export {
  accessibleLabel,
  contentClass,
  iconButtonClass,
  readableCollapsedMark,
  rowClass,
  sectionKey,
  sidebarClass,
};
