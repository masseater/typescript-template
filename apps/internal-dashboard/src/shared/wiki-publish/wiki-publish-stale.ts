import { Schema } from "effect";

class WikiPublishStale extends Schema.TaggedError<WikiPublishStale>()("WikiPublishStale", {}) {}

export { WikiPublishStale };
