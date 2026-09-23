import { Option, Schema } from "effect";

import { laterPage, maximumBoardPage } from "#shared/contracts/index.ts";

const BoardSearchParams = Schema.Struct({
  new: Schema.optionalKey(Schema.Literal(true)),
  page: Schema.optionalKey(laterPage(maximumBoardPage)),
});

const ThreadSearchParams = Schema.Struct({
  page: Schema.optionalKey(laterPage(maximumBoardPage)),
});

type BoardSearch = typeof BoardSearchParams.Type;
type ThreadSearch = typeof ThreadSearchParams.Type;

class InvalidBoardSearch extends Schema.TaggedError<InvalidBoardSearch>()(
  "InvalidBoardSearch",
  {},
) {}

const decodeBoardSearch = Schema.decodeUnknownOption(BoardSearchParams);
const decodeThreadSearch = Schema.decodeUnknownOption(ThreadSearchParams);

function normalizeBoardSearch(raw: unknown): BoardSearch {
  return Option.getOrThrowWith(decodeBoardSearch(raw), () => new InvalidBoardSearch());
}

function normalizeThreadSearch(raw: unknown): ThreadSearch {
  return Option.getOrThrowWith(decodeThreadSearch(raw), () => new InvalidBoardSearch());
}

function pageSearch(page: number): ThreadSearch {
  return page <= 1 ? {} : { page };
}

export { InvalidBoardSearch, normalizeBoardSearch, normalizeThreadSearch, pageSearch };
export type { BoardSearch, ThreadSearch };
