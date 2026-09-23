import { PaginationLink, searchAtPage } from "@repo/ui";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function UserPageLink({
  search,
  target,
}: Readonly<{ search: UsersSearch; target: PageTarget }>): ReactElement {
  return (
    <PaginationLink
      to="/members"
      search={searchAtPage(search, target.page)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { UserPageLink };
