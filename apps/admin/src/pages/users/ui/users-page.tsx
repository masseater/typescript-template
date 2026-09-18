import { Heading } from "@template/ui";
import type { ReactElement } from "react";
import { UserFilters } from "./user-filters.tsx";
import { UserResults } from "./user-results.tsx";
import { useUserList } from "#pages/users/model/user-list.ts";
import { useUsersSearch } from "#pages/users/model/users-search-state.ts";

function UsersPage(): ReactElement {
  const search = useUsersSearch();
  const { reload, result } = useUserList(search);
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        ユーザー一覧
      </Heading>
      <UserFilters search={search} />
      <UserResults search={search} result={result} onReload={reload} />
    </main>
  );
}

export { UsersPage };
