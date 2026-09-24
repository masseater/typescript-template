import { Schema } from "effect";

class WikiPublishFailed extends Schema.TaggedError<WikiPublishFailed>()("WikiPublishFailed", {
  message: Schema.String,
  status: Schema.Finite,
  step: Schema.String,
}) {}

export { WikiPublishFailed };
