import {
  BooleanText,
  Role,
  SearchKeyword,
  absentSearchKey,
  laterPage,
} from "@template/runtime/contracts";
import { Option, Schema } from "effect";
import { maximumUsersPage, usersPageSize } from "#users-pagination.ts";

const Verified = Schema.Union([Schema.Boolean, BooleanText]);

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword).pipe(Schema.catchDecoding(absentSearchKey)),
  page: Schema.optionalKey(laterPage(maximumUsersPage)).pipe(Schema.catchDecoding(absentSearchKey)),
  role: Schema.optionalKey(Role).pipe(Schema.catchDecoding(absentSearchKey)),
  verified: Schema.optionalKey(Verified).pipe(Schema.catchDecoding(absentSearchKey)),
});

type UsersSearch = typeof UsersSearchParams.Type;

const decodeUsersSearch = Schema.decodeUnknownOption(UsersSearchParams);

function normalizeUsersSearch(raw: unknown): UsersSearch {
  return Option.getOrElse(decodeUsersSearch(raw), () => ({}));
}

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
