import { FailedResults } from "./failed-results.tsx";
import { LoadedResults } from "./loaded-results.tsx";
import { UsersTable } from "./users-table.tsx";

import type { UserListState } from "#pages/users/model/user-list.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

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
