import { PaginationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";

function PageItem({
  current = false,
  label,
  page,
  search,
  text,
}: Readonly<{
  current?: boolean;
  label: string;
  page: number;
  search: UsersSearch;
  text: string;
}>): ReactElement {
  const target: UsersSearch = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    ...(page === 1 ? {} : { page }),
  };
  return (
    <li>
      <PaginationLink to="/users" search={target} current={current} aria-label={label}>
        {text}
      </PaginationLink>
    </li>
  );
}

export { PageItem };
