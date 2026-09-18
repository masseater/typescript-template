import { EmptyResults } from "./empty-results.tsx";
import type { ListedUsers } from "#pages/users/api/list-users.ts";
import { PageNavigation } from "@template/ui";
import type { PageTarget } from "@template/ui";
import type { ReactElement } from "react";
import { UserPageLink } from "./user-page-link.tsx";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { UsersTable } from "./users-table.tsx";
import { usersPageSize } from "#pages/users/model/users-pagination.ts";

function LoadedResults({
  list,
  onReload,
  search,
}: Readonly<{ list: ListedUsers; onReload: () => void; search: UsersSearch }>): ReactElement {
  const page = search.page ?? 1;
  function pageLink(target: PageTarget): ReactElement {
    return <UserPageLink search={search} target={target} />;
  }
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
      <PageNavigation
        current={page}
        last={Math.ceil(list.total / usersPageSize)}
        renderLink={pageLink}
      />
    </>
  );
}

export { LoadedResults };
