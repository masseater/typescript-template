import { Schema } from "effect";

class WikiPageNotFound extends Schema.TaggedError<WikiPageNotFound>()("WikiPageNotFound", {
  url: Schema.String,
}) {}

export { WikiPageNotFound };
