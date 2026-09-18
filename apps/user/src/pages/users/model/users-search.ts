import { Option, Schema } from "effect";
import { SearchKeyword, absentSearchKey } from "@template/runtime/contracts";

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword).pipe(Schema.catchDecoding(absentSearchKey)),
});

type UsersSearch = typeof UsersSearchParams.Type;

const decodeUsersSearch = Schema.decodeUnknownOption(UsersSearchParams);

function normalizeUsersSearch(raw: unknown): UsersSearch {
  return Option.getOrElse(decodeUsersSearch(raw), () => ({}));
}

export { normalizeUsersSearch };
export type { UsersSearch };
