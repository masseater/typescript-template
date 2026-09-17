import { BooleanText, Role, UserKeyword } from "@template/runtime/contracts";
import { laterPage, searchNormalizer, searchText } from "@template/ui";
import { Schema } from "effect";
import { usersPageSize } from "#users-pagination.ts";

const Verified = Schema.Union([Schema.Boolean, BooleanText]);

const normalizeUsersSearch = searchNormalizer({
  keyword: searchText(UserKeyword),
  page: laterPage(),
  role: Schema.decodeUnknownOption(Role),
  verified: Schema.decodeUnknownOption(Verified),
});

type UsersSearch = ReturnType<typeof normalizeUsersSearch>;

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
