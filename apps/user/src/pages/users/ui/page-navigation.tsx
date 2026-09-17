import { PageItem } from "./page-item.tsx";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { pageItems } from "@template/ui";

function PageNavigation({
  current,
  last,
  search,
}: Readonly<{ current: number; last: number; search: UsersSearch }>): ReactElement | undefined {
  if (last <= 1) {
    return undefined;
  }
  return (
    <nav aria-label="ページ送り">
      <ul className="flex flex-wrap items-center gap-1">
        {current > 1 && <PageItem page={current - 1} search={search} label="前のページ" text="‹" />}
        {pageItems({ current, last }).map((item) =>
          item.kind === "gap" ? (
            <li key={`gap-${item.after}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <PageItem
              key={item.page}
              page={item.page}
              search={search}
              current={item.page === current}
              label={`${item.page} ページ目`}
              text={String(item.page)}
            />
          ),
        )}
        {current < last && (
          <PageItem page={current + 1} search={search} label="次のページ" text="›" />
        )}
      </ul>
    </nav>
  );
}

export { PageNavigation };
