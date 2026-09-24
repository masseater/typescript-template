import { FailedResults } from "./failed-results.tsx";
import { LoadedResults } from "./loaded-results.tsx";
import { UsersTable } from "./users-table.tsx";

import type { ListedUsers } from "#pages/users/model/user-list.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

function UserResults({
  list,
  onReload,
  search,
}: Readonly<{
  list: Readonly<{ data: ListedUsers | undefined; error: string | undefined }>;
  onReload: () => void;
  search: UsersSearch;
}>): ReactElement {
  if (list.error !== undefined) {
    return <FailedResults message={list.error} onReload={onReload} />;
  }
  if (list.data === undefined) {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  return <LoadedResults list={list.data} search={search} onReload={onReload} />;
}

export { UserResults };
