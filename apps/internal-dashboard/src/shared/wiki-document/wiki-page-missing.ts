import { Schema } from "effect";

class WikiPageMissing extends Schema.TaggedError<WikiPageMissing>()("WikiPageMissing", {}) {}

export { WikiPageMissing };
