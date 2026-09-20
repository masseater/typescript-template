import { Schema } from "effect";

class BoardThreadNotFound extends Schema.TaggedError<BoardThreadNotFound>()(
  "BoardThreadNotFound",
  {},
) {}

export { BoardThreadNotFound };
