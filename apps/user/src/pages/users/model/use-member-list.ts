import { useEffect, useState } from "react";
import type { Member } from "#entities/member/index.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { VirtualItem } from "@tanstack/react-virtual";
import { membersOptions } from "#pages/users/api/members-api.ts";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface MemberRow {
  readonly item: Readonly<VirtualItem>;
  readonly member: Member;
  readonly offset: number;
}

interface MemberList {
  readonly listHeight: number;
  readonly listRef: (node: HTMLElement | null) => void;
  readonly loading: boolean;
  readonly measure: (node: Element | null) => void;
  readonly rows: readonly MemberRow[];
  readonly shown: number;
  readonly total: number;
}

const estimatedCardHeight = 92;
const cardGap = 16;
const overscan = 4;
const ssrViewport = { height: 1080, width: 1280 };

function useMemberList(search: UsersSearch): MemberList {
  "use no memo";
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    membersOptions(search),
  );
  const members = data.pages.flatMap((page) => page.members);
  const [scrollMargin, setScrollMargin] = useState(0);
  const virtualizer = useWindowVirtualizer({
    count: members.length,
    estimateSize: () => estimatedCardHeight,
    gap: cardGap,
    initialRect: ssrViewport,
    overscan,
    scrollMargin,
  });
  const items = virtualizer.getVirtualItems();
  const reached = (items.at(-1)?.index ?? 0) >= members.length - 1;
  useEffect(() => {
    if (reached && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, reached]);
  function listRef(node: HTMLElement | null): void {
    if (node !== null && scrollMargin === 0) {
      setScrollMargin(node.offsetTop);
    }
  }
  return {
    listHeight: virtualizer.getTotalSize(),
    listRef,
    loading: isFetchingNextPage,
    measure: virtualizer.measureElement,
    rows: items.flatMap((item) => {
      const member = members[item.index];
      return member === undefined ? [] : [{ item, member, offset: item.start - scrollMargin }];
    }),
    shown: members.length,
    total: data.pages.flatMap((page) => [page.total])[0] ?? members.length,
  };
}

export { useMemberList };
export type { MemberRow };
