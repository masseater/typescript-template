import { PaginationLink, type PageTarget } from "@template/ui";

import { normalizeUsersSearch, type UsersSearch } from "#pages/users/model/users-search.ts";

import type { ReactElement } from "react";

const MemberPageLink = ({
  search,
  target,
}: Readonly<{ search: UsersSearch; target: PageTarget }>): ReactElement => {
  return (
    <PaginationLink
      to="/users"
      search={normalizeUsersSearch({ ...search, page: target.page })}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
};

export { MemberPageLink };
