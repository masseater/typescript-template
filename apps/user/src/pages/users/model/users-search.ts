import { SearchKeyword, laterPage, maximumMemberPage } from "@repo/runtime/contracts";
import { Option, Schema } from "effect";

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

export { decodeUsersSearch };
export type { UsersSearch };
