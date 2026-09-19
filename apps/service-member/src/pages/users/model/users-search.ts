import {
  SearchKeyword,
  absentSearchKey,
  laterPage,
  maximumMemberPage,
} from "@repo/runtime/contracts";
import { Option, Schema } from "effect";

const UsersSearchParams = Schema.Struct({
  keyword: Schema.optionalKey(SearchKeyword).pipe(Schema.catchDecoding(absentSearchKey)),
  page: Schema.optionalKey(laterPage(maximumMemberPage)).pipe(
    Schema.catchDecoding(absentSearchKey),
  ),
});

type UsersSearch = typeof UsersSearchParams.Type;

const decodeUsersSearch = Schema.decodeUnknownOption(UsersSearchParams);

function normalizeUsersSearch(raw: unknown): UsersSearch {
  return Option.getOrElse(decodeUsersSearch(raw), () => ({}));
}

export { normalizeUsersSearch };
export type { UsersSearch };
