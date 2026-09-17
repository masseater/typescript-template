import type { PageTarget } from "@template/ui/ui";
import { PaginationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";

function MemberPageLink({
  search,
  target,
}: Readonly<{ search: UsersSearch; target: PageTarget }>): ReactElement {
  const destination: UsersSearch = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    ...(target.page === 1 ? {} : { page: target.page }),
  };
  return (
    <PaginationLink
      to="/users"
      search={destination}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { MemberPageLink };
