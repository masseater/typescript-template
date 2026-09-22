import { Heading } from "@repo/ui";

import { useUserList } from "#pages/users/model/user-list.ts";
import { useUsersSearch } from "#pages/users/model/users-search-state.ts";
import { MembersQueueSummary } from "./members-queue-summary.tsx";
import { UserFilters } from "./user-filters.tsx";
import { UserResults } from "./user-results.tsx";

import type { ReactElement } from "react";

function UsersPage(): ReactElement {
  const search = useUsersSearch();
  const { list, reload } = useUserList(search);
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        利用者の一覧
      </Heading>
      <MembersQueueSummary />
      <UserFilters key={JSON.stringify(search)} search={search} />
      <UserResults list={list} onReload={reload} search={search} />
    </main>
  );
}

export { UsersPage };
