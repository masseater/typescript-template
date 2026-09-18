import { useSearch } from "@tanstack/react-router";

import { normalizeUsersSearch } from "#pages/users/model/users-search.ts";
import { SearchFields } from "./search-fields.tsx";

import type { ReactElement } from "react";

const SearchForm = (): ReactElement => {
  const keyword = normalizeUsersSearch(useSearch({ strict: false })).keyword ?? "";
  return <SearchFields key={keyword} keyword={keyword} />;
};

export { SearchForm };
