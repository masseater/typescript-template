import { useSearch } from "@tanstack/react-router";
import { Option } from "effect";

import { decodeUsersSearch } from "#pages/users/model/users-search.ts";
import { SearchFields } from "#widgets/member-search/index.ts";

import type { ReactElement } from "react";

function SearchForm(): ReactElement {
  const keyword = Option.match(decodeUsersSearch(useSearch({ strict: false })), {
    onNone: () => "",
    onSome: (search) => search.keyword ?? "",
  });
  return <SearchFields keyword={keyword} />;
}

export { SearchForm };
