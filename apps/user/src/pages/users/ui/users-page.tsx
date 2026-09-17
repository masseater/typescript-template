import type { Members } from "#pages/users/api/load-members.ts";
import type { ReactElement } from "react";
import { Results } from "./results.tsx";
import { SearchForm } from "./search-form.tsx";
import { UsersBody } from "./users-body.tsx";
import type { UsersSearch } from "#pages/users/model/users-search.ts";

function UsersPage({
  list,
  search,
}: Readonly<{ list: Members; search: UsersSearch }>): ReactElement {
  return (
    <UsersBody>
      <SearchForm key={search.keyword ?? ""} keyword={search.keyword} />
      <Results list={list} search={search} />
    </UsersBody>
  );
}

export { UsersPage };
