import { Schema } from "effect";

class WikiPublishKeyInvalid extends Schema.TaggedError<WikiPublishKeyInvalid>()(
  "WikiPublishKeyInvalid",
  { cause: Schema.Defect() },
) {}

export { WikiPublishKeyInvalid };
