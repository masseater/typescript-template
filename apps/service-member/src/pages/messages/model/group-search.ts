import { Option, Schema } from "effect";

const GroupSearchParams = Schema.Struct({
  invite: Schema.optionalKey(Schema.String.check(Schema.isLengthBetween(1, 200))),
});

type GroupSearch = typeof GroupSearchParams.Type;

class InvalidGroupSearch extends Error {
  override readonly name = "InvalidGroupSearch";
}

const decodeGroupSearch = Schema.decodeUnknownOption(GroupSearchParams);

function normalizeGroupSearch(raw: unknown): GroupSearch {
  return Option.getOrThrowWith(decodeGroupSearch(raw), () => new InvalidGroupSearch());
}

export { InvalidGroupSearch, normalizeGroupSearch };
export type { GroupSearch };
