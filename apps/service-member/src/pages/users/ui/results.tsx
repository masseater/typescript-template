import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { membersOptions } from "#pages/users/api/load-members.ts";
import { ResultList } from "./result-list.tsx";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

function Results({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  const listing = useSuspenseInfiniteQuery(membersOptions(search));
  return (
    <ResultList
      fetchNextPage={listing.fetchNextPage}
      hasNextPage={listing.hasNextPage}
      isFetchingNextPage={listing.isFetchingNextPage}
      members={listing.data.pages.flatMap((page) => page.members)}
      total={listing.data.pages[0]?.total ?? 0}
    />
  );
}

export { Results };
