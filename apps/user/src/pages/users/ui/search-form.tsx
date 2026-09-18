import type { ReactElement } from "react";
import { SearchFields } from "./search-fields.tsx";
import { normalizeUsersSearch } from "#pages/users/model/users-search.ts";
import { useSearch } from "@tanstack/react-router";

function SearchForm(): ReactElement {
  const keyword = normalizeUsersSearch(useSearch({ strict: false })).keyword ?? "";
  return <SearchFields keyword={keyword} />;
}

export { SearchForm };
