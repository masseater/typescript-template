import { TextLink } from "@repo/ui";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useState } from "react";

import { membersOptions } from "#pages/users/api/load-members.ts";
import { memberPageSize } from "#shared/contracts/index.ts";
import { MemberCard } from "#widgets/member-search/index.ts";

import type { Member } from "#pages/users/api/load-members.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

const rowEstimate = 168;
const columns = 3;

function membersOf(pages: ReadonlyArray<{ members: readonly Member[] }>): readonly Member[] {
  return pages.flatMap((page) => page.members);
}

function StaticGrid({ members }: Readonly<{ members: readonly Member[] }>): ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </ul>
  );
}

function VirtualizedGrid({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  members,
  total,
}: Readonly<{
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  members: readonly Member[];
  total: number;
}>): ReactElement {
  const rowCount = Math.ceil(members.length / columns);
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowEstimate,
    overscan: 3,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastRow = virtualRows[virtualRows.length - 1];
  useEffect(() => {
    if (
      lastRow !== undefined &&
      lastRow.index >= rowCount - 2 &&
      hasNextPage &&
      isFetchingNextPage === false
    ) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, lastRow, rowCount]);
  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualRows.map((row) => {
        const start = row.index * columns;
        const rowMembers = members.slice(start, start + columns);
        return (
          <ul
            key={row.key}
            className="absolute top-0 left-0 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {rowMembers.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </ul>
        );
      })}
      {isFetchingNextPage && (
        <p className="absolute bottom-0 w-full py-4 text-center text-sm text-muted-foreground">
          読み込み中です。
        </p>
      )}
      <p className="sr-only">
        {total} 人中 {members.length} 人を表示しています。
      </p>
    </div>
  );
}

function Results({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  const listing = useSuspenseInfiniteQuery(membersOptions(search));
  const members = membersOf(listing.data.pages);
  const total = listing.data.pages[0]?.total ?? 0;
  const [virtualReady, setVirtualReady] = useState(false);
  useLayoutEffect(() => {
    setVirtualReady(true);
  }, []);
  if (total === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致する利用者はいません。<TextLink to="/search">条件を外す</TextLink>
      </p>
    );
  }
  if (members.length === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致する利用者はいません。<TextLink to="/search">条件を外す</TextLink>
      </p>
    );
  }
  const first = 1;
  const last = members.length;
  return (
    <>
      <p className="text-sm leading-normal text-muted-foreground">
        {total} 人中 {first}〜{last} 人{members.length < total ? "（読み込み中の分を含む）" : ""}
      </p>
      {virtualReady ? (
        <VirtualizedGrid
          fetchNextPage={listing.fetchNextPage}
          hasNextPage={listing.hasNextPage}
          isFetchingNextPage={listing.isFetchingNextPage}
          members={members}
          total={total}
        />
      ) : (
        <StaticGrid members={members.slice(0, memberPageSize)} />
      )}
    </>
  );
}

export { Results };
