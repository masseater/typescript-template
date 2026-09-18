import { pageItems } from "./page-items";

import type { ReactElement } from "react";

interface PageTarget {
  readonly current: boolean;
  readonly label: string;
  readonly page: number;
  readonly text: string;
}

function PageNavigation({
  current,
  last,
  renderLink,
}: Readonly<{
  current: number;
  last: number;
  renderLink: (target: PageTarget) => ReactElement;
}>): ReactElement | undefined {
  if (last <= 1) {
    return undefined;
  }
  const targets: readonly (PageTarget | undefined)[] = [
    ...(current > 1 ? [{ current: false, label: "前のページ", page: current - 1, text: "‹" }] : []),
    ...pageItems({ current, last }).map((item) =>
      item.kind === "gap"
        ? undefined
        : {
            current: item.page === current,
            label: `${item.page} ページ目`,
            page: item.page,
            text: String(item.page),
          },
    ),
    ...(current < last
      ? [{ current: false, label: "次のページ", page: current + 1, text: "›" }]
      : []),
  ];
  return (
    <nav data-slot="page-navigation" aria-label="ページ送り">
      <ul className="flex flex-wrap items-center gap-1">
        {targets.map((target, index) =>
          target === undefined ? (
            // oxlint-disable-next-line react/no-array-index-key
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={target.label}>{renderLink(target)}</li>
          ),
        )}
      </ul>
    </nav>
  );
}

export { PageNavigation };
export type { PageTarget };
