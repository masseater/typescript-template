import { PageNavigation } from "@template/ui";

import { usersPageSize } from "#pages/users/model/users-pagination.ts";
import { EmptyResults } from "./empty-results.tsx";
import { UserPageLink } from "./user-page-link.tsx";
import { UsersTable } from "./users-table.tsx";

import type { ListedUsers } from "#pages/users/model/user-list.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { PageTarget } from "@template/ui";
import type { ReactElement } from "react";

const LoadedResults = ({
  list,
  onReload,
  search,
}: Readonly<{ list: ListedUsers; onReload: () => void; search: UsersSearch }>): ReactElement => {
  if (list.users.length === 0) {
    return <EmptyResults beyondLastPage={list.total > 0} search={search} />;
  }
  const page = search.page ?? 1;
  const first = (page - 1) * usersPageSize + 1;
  const last = first + list.users.length - 1;
  const pageLink = (target: PageTarget): ReactElement => {
    return <UserPageLink search={search} target={target} />;
  };
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
};

export { LoadedResults };
