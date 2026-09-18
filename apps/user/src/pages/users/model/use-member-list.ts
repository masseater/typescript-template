import { useEffect, useState } from "react";
import type { Member } from "#pages/users/api/members-api.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { VirtualItem } from "@tanstack/react-virtual";
import { membersOptions } from "#pages/users/api/members-api.ts";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface MemberList {
  readonly items: readonly Readonly<VirtualItem>[];
  readonly listHeight: number;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly listRef: (node: HTMLElement | null) => void;
  readonly loading: boolean;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly measure: (node: Element | null) => void;
  readonly members: readonly Member[];
  readonly scrollMargin: number;
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  function listRef(node: HTMLElement | null): void {
    if (node !== null && scrollMargin === 0) {
      setScrollMargin(node.offsetTop);
    }
  }
  return {
    items,
    listHeight: virtualizer.getTotalSize(),
    listRef,
    loading: isFetchingNextPage,
    measure: virtualizer.measureElement,
    members,
    scrollMargin,
    total: data.pages[0]?.total ?? 0,
  };
}

export { useMemberList };
