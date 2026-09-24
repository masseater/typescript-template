import { Schema } from "effect";

class WikiPublishUnreachable extends Schema.TaggedError<WikiPublishUnreachable>()(
  "WikiPublishUnreachable",
  { cause: Schema.Defect(), step: Schema.String },
) {}

export { WikiPublishUnreachable };
