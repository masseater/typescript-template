import { Results } from "./results.tsx";
import { UsersBody } from "./users-body.tsx";

import type { Members } from "#pages/users/api/load-members.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

const UsersPage = ({
  list,
  search,
}: Readonly<{ list: Members; search: UsersSearch }>): ReactElement => {
  return (
    <UsersBody>
      <Results list={list} search={search} />
    </UsersBody>
  );
};

export { UsersPage };
