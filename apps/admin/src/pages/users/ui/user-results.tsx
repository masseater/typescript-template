import { FailedResults } from "./failed-results.tsx";
import type { ListedUsers } from "#pages/users/api/list-users.ts";
import { LoadedResults } from "./loaded-results.tsx";
import type { ReactElement } from "react";
import type { ServerQueryResult } from "@template/ui";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { UsersTable } from "./users-table.tsx";

function UserResults({
  onReload,
  result,
  search,
}: Readonly<{
  onReload: () => void;
  result: ServerQueryResult<ListedUsers>;
  search: UsersSearch;
}>): ReactElement {
  if (result.status === "pending") {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  if (result.status === "failure") {
    return <FailedResults message={result.message} onReload={onReload} />;
  }
  return <LoadedResults list={result.value} search={search} onReload={onReload} />;
}

export { UserResults };
