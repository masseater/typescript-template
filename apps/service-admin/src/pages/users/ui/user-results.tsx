import { resultError, type RequestResult } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { FailedResults } from "./failed-results.tsx";
import { LoadedResults } from "./loaded-results.tsx";
import { UsersTable } from "./users-table.tsx";

import type { ListedUsers } from "#pages/users/model/user-list.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

function UserResults({
  listing,
  onReload,
  search,
}: Readonly<{
  listing: RequestResult<ListedUsers>;
  onReload: () => void;
  search: UsersSearch;
}>): ReactElement {
  const failure = resultError(listing);
  if (failure !== undefined) {
    return <FailedResults message={failure} onReload={onReload} />;
  }
  if (!AsyncResult.isSuccess(listing) || listing.waiting) {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  return <LoadedResults list={listing.value} search={search} onReload={onReload} />;
}

export { UserResults };
