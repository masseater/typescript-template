import { Heading } from "@template/ui";
import type { ReactElement } from "react";
import { UserFilters } from "#components/user-filters.tsx";
import { UserResults } from "#components/user-results.tsx";
import { useUserList } from "#user-list.ts";
import { useUsersSearch } from "#users-search-state.ts";

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
