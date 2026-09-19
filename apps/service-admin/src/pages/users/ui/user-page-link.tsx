import { PaginationLink } from "@repo/ui";

import { normalizeUsersSearch } from "#pages/users/model/users-search.ts";

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
      search={normalizeUsersSearch({ ...search, page: target.page })}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { UserPageLink };
