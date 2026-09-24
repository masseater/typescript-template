import { Schema } from "effect";

class WikiPageInvalid extends Schema.TaggedError<WikiPageInvalid>()("WikiPageInvalid", {}) {}

export { WikiPageInvalid };
