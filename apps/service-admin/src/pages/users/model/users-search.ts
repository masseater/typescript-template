import { SearchKeyword, laterPage, searchNormalizer } from "@repo/config/paging";
import { Schema } from "effect";

import { BooleanText, Role } from "#shared/contracts/index.ts";
import { maximumUsersPage, usersPageSize } from "./users-pagination.ts";

const Verified = Schema.Union([Schema.Boolean, BooleanText]);

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword),
  page: Schema.optionalKey(laterPage(maximumUsersPage)),
  role: Schema.optionalKey(Role),
  verified: Schema.optionalKey(Verified),
});

type UsersSearch = typeof UsersSearchParams.Type;

const normalizeUsersSearch = searchNormalizer(UsersSearchParams);

function userListQuery(search: UsersSearch): Readonly<Record<string, string>> {
  return {
    limit: String(usersPageSize),
    offset: String(((search.page ?? 1) - 1) * usersPageSize),
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    ...(search.role === undefined ? {} : { role: search.role }),
    ...(search.verified === undefined ? {} : { emailVerified: String(search.verified) }),
  };
}

export { normalizeUsersSearch, userListQuery };
export type { UsersSearch };
