import { Schema } from "effect";

class WikiPublishUnavailable extends Schema.TaggedError<WikiPublishUnavailable>()(
  "WikiPublishUnavailable",
  {},
) {}

export { WikiPublishUnavailable };
