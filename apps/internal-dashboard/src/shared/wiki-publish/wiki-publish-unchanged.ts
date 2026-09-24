import { Schema } from "effect";

class WikiPublishUnchanged extends Schema.TaggedError<WikiPublishUnchanged>()(
  "WikiPublishUnchanged",
  {},
) {}

export { WikiPublishUnchanged };
