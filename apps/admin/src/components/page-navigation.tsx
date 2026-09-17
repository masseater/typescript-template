import { PageGap } from "#components/page-gap.tsx";
import { PageLink } from "#components/page-link.tsx";
import type { ReactElement } from "react";
import type { UsersSearch } from "#users-search.ts";
import { pageItems } from "#page-items.ts";

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
        {current > 1 && (
          <PageLink
            page={current - 1}
            search={search}
            label="前のページ"
            text="‹"
            current={false}
          />
        )}
        {pageItems({ current, last }).map((item) =>
          item.kind === "gap" ? (
            <PageGap key={`gap-${item.after}`} />
          ) : (
            <PageLink
              key={item.page}
              page={item.page}
              search={search}
              label={`${item.page} ページ目`}
              text={String(item.page)}
              current={item.page === current}
            />
          ),
        )}
        {current < last && (
          <PageLink
            page={current + 1}
            search={search}
            label="次のページ"
            text="›"
            current={false}
          />
        )}
      </ul>
    </nav>
  );
}

export { PageNavigation };
