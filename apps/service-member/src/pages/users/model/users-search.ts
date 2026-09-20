import { Option, Schema } from "effect";

import { SearchKeyword, laterPage, maximumMemberPage } from "#shared/contracts/index.ts";

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword),
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

type UsersSearch = typeof UsersSearchParams.Type;

class InvalidUsersSearch extends Error {
  override readonly name = "InvalidUsersSearch";
}

const decodeUsersSearch = Schema.decodeUnknownOption(UsersSearchParams);

function normalizeUsersSearch(raw: unknown): UsersSearch {
  return Option.getOrThrowWith(decodeUsersSearch(raw), () => new InvalidUsersSearch());
}

export { InvalidUsersSearch, decodeUsersSearch, normalizeUsersSearch };
export type { UsersSearch };
