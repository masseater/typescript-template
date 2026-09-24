import { SearchKeyword, laterPage, searchNormalizer } from "@repo/config/paging";
import { Schema } from "effect";

import { maximumMemberPage } from "#shared/contracts/index.ts";

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword),
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

type UsersSearch = typeof UsersSearchParams.Type;

const decodeUsersSearch = Schema.decodeUnknownOption(UsersSearchParams);
const normalizeUsersSearch = searchNormalizer(UsersSearchParams);

export { decodeUsersSearch, normalizeUsersSearch };
export type { UsersSearch };
