import type { ReactElement } from "react";

import { useUserList } from "#pages/users/model/user-list.ts";
import { useUsersSearch } from "#pages/users/model/users-search-state.ts";
import { Heading } from "@repo/ui";

import { UserFilters } from "./user-filters.tsx";
import { UserResults } from "./user-results.tsx";

function UsersPage(): ReactElement {
  const search = useUsersSearch();
  const { reload, state } = useUserList(search);
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        ユーザー一覧
      </Heading>
      <UserFilters key={JSON.stringify(search)} search={search} />
      <UserResults search={search} state={state} onReload={reload} />
    </main>
  );
}

export { UsersPage };
