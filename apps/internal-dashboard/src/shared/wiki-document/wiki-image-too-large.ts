import { Schema } from "effect";

class WikiImageTooLarge extends Schema.TaggedError<WikiImageTooLarge>()("WikiImageTooLarge", {}) {}

export { WikiImageTooLarge };
