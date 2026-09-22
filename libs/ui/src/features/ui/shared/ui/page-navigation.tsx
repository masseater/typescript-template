import { pageItems } from "./page-items";

import type { ReactElement } from "react";

type PageTarget = {
  readonly current: boolean;
  readonly label: string;
  readonly page: number;
  readonly text: string;
};

type NavigationEntry =
  | Readonly<{ kind: "gap"; after: number }>
  | Readonly<{ kind: "page"; target: PageTarget }>;

const PageNavigation = ({
  current,
  last,
  renderLink,
}: Readonly<{
  current: number;
  last: number;
  renderLink: (navigationTarget: PageTarget) => ReactElement;
}>): ReactElement | undefined => {
  if (last <= 1) {
    return undefined;
  }
  const navigationEntries: readonly NavigationEntry[] = [
    ...(current > 1
      ? [
          {
            kind: "page" as const,
            target: { current: false, label: "前のページ", page: current - 1, text: "‹" },
          },
        ]
      : []),
    ...pageItems({ current, last }).map((pageItem): NavigationEntry =>
      pageItem.kind === "gap"
        ? pageItem
        : {
            kind: "page",
            target: {
              current: pageItem.page === current,
              label: `${pageItem.page} ページ目`,
              page: pageItem.page,
              text: String(pageItem.page),
            },
          },
    ),
    ...(current < last
      ? [
          {
            kind: "page" as const,
            target: { current: false, label: "次のページ", page: current + 1, text: "›" },
          },
        ]
      : []),
  ];
  return (
    <nav data-slot="page-navigation" aria-label="ページ送り">
      <ul className="flex flex-wrap items-center gap-1">
        {navigationEntries.map((navigationEntry) =>
          navigationEntry.kind === "gap" ? (
            <li
              key={`gap-after-${String(navigationEntry.after)}`}
              aria-hidden="true"
              className="px-1 text-muted-foreground"
            >
              {"…"}
            </li>
          ) : (
            <li key={navigationEntry.target.label}>{renderLink(navigationEntry.target)}</li>
          ),
        )}
      </ul>
    </nav>
  );
};

export { PageNavigation };
export type { PageTarget };
