import { Results } from "./results.tsx";
import { UsersBody } from "./users-body.tsx";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

function UsersPage({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  return (
    <UsersBody>
      <Results search={search} />
    </UsersBody>
  );
}

export { UsersPage };
