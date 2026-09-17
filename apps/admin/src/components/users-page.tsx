import { Heading } from "@template/ui/ui";
import type { ReactElement } from "react";
import { UserFilters } from "#components/user-filters.tsx";
import { UserResults } from "#components/user-results.tsx";
import { getRouteApi } from "@tanstack/react-router";
import { useUserList } from "#user-list.ts";

const route = getRouteApi("/_admin/");

function UsersPage(): ReactElement {
  const search = route.useSearch();
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
