import { FailedResults } from "#components/failed-results.tsx";
import { LoadedResults } from "#components/loaded-results.tsx";
import type { ReactElement } from "react";
import type { UserListState } from "#user-list.ts";
import type { UsersSearch } from "#users-search.ts";
import { UsersTable } from "#components/users-table.tsx";

function UserResults({
  onReload,
  search,
  state,
}: Readonly<{ onReload: () => void; search: UsersSearch; state: UserListState }>): ReactElement {
  if (state.status === "failed") {
    return <FailedResults message={state.message} onReload={onReload} />;
  }
  if (state.status === "loading") {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  return <LoadedResults list={state.list} search={search} onReload={onReload} />;
}

export { UserResults };
