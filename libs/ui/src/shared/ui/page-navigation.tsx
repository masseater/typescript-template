import { pageItems } from "./page-items";

import type { ReactElement } from "react";

type PageTarget = {
  readonly current: boolean;
  readonly label: string;
  readonly page: number;
  readonly text: string;
};

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
  const navigationTargets: readonly (PageTarget | undefined)[] = [
    ...(current > 1 ? [{ current: false, label: "前のページ", page: current - 1, text: "‹" }] : []),
    ...pageItems({ current, last }).map((pageItem) =>
      pageItem.kind === "gap"
        ? undefined
        : {
            current: pageItem.page === current,
            label: `${pageItem.page} ページ目`,
            page: pageItem.page,
            text: String(pageItem.page),
          },
    ),
    ...(current < last
      ? [{ current: false, label: "次のページ", page: current + 1, text: "›" }]
      : []),
  ];
  return (
    <nav data-slot="page-navigation" aria-label="ページ送り">
      <ul className="flex flex-wrap items-center gap-1">
        {navigationTargets.map((navigationTarget, index) =>
          navigationTarget === undefined ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={navigationTarget.label}>{renderLink(navigationTarget)}</li>
          ),
        )}
      </ul>
    </nav>
  );
};

export { PageNavigation };
export type { PageTarget };
