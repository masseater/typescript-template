import { PaginationLink } from "@repo/ui";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function usersSearchAtPage(search: UsersSearch, page: number): UsersSearch {
  const { page: _current, ...filters } = search;
  return page <= 1 ? filters : { ...filters, page };
}

function UserPageLink({
  search,
  target,
}: Readonly<{ search: UsersSearch; target: PageTarget }>): ReactElement {
  return (
    <PaginationLink
      to="/members"
      search={usersSearchAtPage(search, target.page)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { UserPageLink };
