import { useEffect, useState } from "react";
import type { Member } from "#pages/users/api/members-api.ts";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { membersOptions } from "#pages/users/api/members-api.ts";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface MemberList {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly listRef: (node: HTMLElement | null) => void;
  readonly loading: boolean;
  readonly members: readonly Member[];
  readonly scrollMargin: number;
  readonly total: number;
  readonly virtualizer: ReactVirtualizer<Window, Element>;
}

const estimatedCardHeight = 92;
const cardGap = 16;
const overscan = 4;
const ssrViewport = { height: 1080, width: 1280 };

function useMemberList(search: UsersSearch): MemberList {
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
  const reached = (virtualizer.getVirtualItems().at(-1)?.index ?? 0) >= members.length - 1;
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
    listRef,
    loading: isFetchingNextPage,
    members,
    scrollMargin,
    total: data.pages[0]?.total ?? 0,
    virtualizer,
  };
}

export { useMemberList };
