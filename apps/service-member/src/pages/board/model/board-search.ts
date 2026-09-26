import { laterPage } from "@repo/runtime/contracts";
import { searchValidator } from "@repo/ui";
import { Schema } from "effect";

import { maximumBoardPage } from "#shared/contracts/index.ts";

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

const normalizeBoardSearch = searchValidator(decodeBoardSearch, () => InvalidBoardSearch.make());

const normalizeThreadSearch = searchValidator(decodeThreadSearch, () => InvalidBoardSearch.make());

function pageSearch(page: number): ThreadSearch {
  return page <= 1 ? {} : { page };
}

export { InvalidBoardSearch, normalizeBoardSearch, normalizeThreadSearch, pageSearch };
export type { BoardSearch, ThreadSearch };
