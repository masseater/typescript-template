import { Schema } from "effect";

class UnderstandingFailed extends Schema.TaggedError<UnderstandingFailed>()("UnderstandingFailed", {
  reason: Schema.Literals(["unavailable", "model_failed"]),
}) {}

export { UnderstandingFailed };
