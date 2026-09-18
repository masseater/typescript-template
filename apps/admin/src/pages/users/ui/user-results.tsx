import { AsyncResult } from "effect/unstable/reactivity";
import { FailedResults } from "./failed-results.tsx";
import type { ListedUsers } from "#pages/users/api/list-users.ts";
import { LoadedResults } from "./loaded-results.tsx";
import type { ReactElement } from "react";
import type { RequestResult } from "@template/ui";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { UsersTable } from "./users-table.tsx";
import { resultError } from "@template/ui";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function UserResults({
  onReload,
  result,
  search,
}: Readonly<{
  onReload: () => void;
  result: RequestResult<ListedUsers>;
  search: UsersSearch;
}>): ReactElement {
  const error = resultError(result);
  if (error !== undefined) {
    return <FailedResults message={error} onReload={onReload} />;
  }
  if (!AsyncResult.isSuccess(result) || result.waiting) {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  return <LoadedResults list={result.value} search={search} onReload={onReload} />;
}

export { UserResults };
