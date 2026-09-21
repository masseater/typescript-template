import { Option, Schema } from "effect";

const GroupsSearchParams = Schema.Struct({
  invite: Schema.optionalKey(Schema.String),
});

type GroupsSearch = typeof GroupsSearchParams.Type;

class InvalidGroupsSearch extends Error {
  override readonly name = "InvalidGroupsSearch";
}

const decodeGroupsSearch = Schema.decodeUnknownOption(GroupsSearchParams);

function normalizeGroupsSearch(raw: unknown): GroupsSearch {
  return Option.getOrThrowWith(decodeGroupsSearch(raw), () => new InvalidGroupsSearch());
}

export { InvalidGroupsSearch, normalizeGroupsSearch };
export type { GroupsSearch };
