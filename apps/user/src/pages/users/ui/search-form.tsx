import { useSearch } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { normalizeUsersSearch } from "#pages/users/model/users-search.ts";

import { SearchFields } from "./search-fields.tsx";

function SearchForm(): ReactElement {
  const keyword = normalizeUsersSearch(useSearch({ strict: false })).keyword ?? "";
  return <SearchFields key={keyword} keyword={keyword} />;
}

export { SearchForm };
