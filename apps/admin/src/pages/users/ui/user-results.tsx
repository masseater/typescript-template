import { AsyncResult } from "effect/unstable/reactivity";
import { FailedResults } from "./failed-results.tsx";
import { LoadedResults } from "./loaded-results.tsx";
import type { ReactElement } from "react";
import type { UserListResult } from "#pages/users/model/user-list.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { UsersTable } from "./users-table.tsx";
import { failureMessage } from "@template/ui";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function UserResults({
  onReload,
  result,
  search,
}: Readonly<{ onReload: () => void; result: UserListResult; search: UsersSearch }>): ReactElement {
  if (result.waiting || AsyncResult.isInitial(result)) {
    return <UsersTable users={undefined} onChanged={onReload} />;
  }
  if (AsyncResult.isFailure(result)) {
    return <FailedResults message={failureMessage(result)} onReload={onReload} />;
  }
  return <LoadedResults list={result.value} search={search} onReload={onReload} />;
}

export { UserResults };
