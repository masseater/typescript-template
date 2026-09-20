import { Schema } from "effect";

class BoardMemberRequired extends Schema.TaggedError<BoardMemberRequired>()(
  "BoardMemberRequired",
  {},
) {}

export { BoardMemberRequired };
