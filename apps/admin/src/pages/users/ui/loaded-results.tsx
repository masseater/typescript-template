import { EmptyResults } from "./empty-results.tsx";
import type { ListedUsers } from "#pages/users/model/user-list.ts";
import { PageNavigation } from "./page-navigation.tsx";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { UsersTable } from "./users-table.tsx";
import { usersPageSize } from "#pages/users/model/users-pagination.ts";

function LoadedResults({
  list,
  onReload,
  search,
}: Readonly<{ list: ListedUsers; onReload: () => void; search: UsersSearch }>): ReactElement {
  const page = search.page ?? 1;
  if (list.users.length === 0) {
    return <EmptyResults beyondLastPage={list.total > 0} search={search} />;
  }
  const first = (page - 1) * usersPageSize + 1;
  const last = first + list.users.length - 1;
  return (
    <>
      <p className="text-base leading-normal text-muted-foreground">
        {`${list.total} 件中 ${first}〜${last} 件`}
      </p>
      <UsersTable users={list.users} onChanged={onReload} />
      <PageNavigation current={page} last={Math.ceil(list.total / usersPageSize)} search={search} />
    </>
  );
}

export { LoadedResults };
