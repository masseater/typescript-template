import { Heading } from "@repo/ui";

import { useUserList } from "#pages/users/model/user-list.ts";
import { useUsersSearch } from "#pages/users/model/users-search-state.ts";
import { MetricCards } from "#widgets/mock-page/index.ts";
import { UserFilters } from "./user-filters.tsx";
import { UserResults } from "./user-results.tsx";

import type { ReactElement } from "react";

const pending = [
  { label: "問い合わせ", value: "5" },
  { label: "通報", value: "2" },
  { label: "停止中", value: "1" },
] as const;

function UsersPage(): ReactElement {
  const search = useUsersSearch();
  const { reload, state } = useUserList(search);
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        利用者の一覧
      </Heading>
      <MetricCards items={pending} />
      <UserFilters key={JSON.stringify(search)} search={search} />
      <UserResults search={search} state={state} onReload={reload} />
    </main>
  );
}

export { UsersPage };
