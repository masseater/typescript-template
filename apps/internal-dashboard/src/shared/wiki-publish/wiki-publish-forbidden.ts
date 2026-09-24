import { Schema } from "effect";

class WikiPublishForbidden extends Schema.TaggedError<WikiPublishForbidden>()(
  "WikiPublishForbidden",
  {},
) {}

export { WikiPublishForbidden };
