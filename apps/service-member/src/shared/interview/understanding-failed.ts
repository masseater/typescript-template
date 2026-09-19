import { Schema } from "effect";

class UnderstandingFailed extends Schema.TaggedError<UnderstandingFailed>()("UnderstandingFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["unavailable", "model_failed", "timed_out"]),
}) {}

export { UnderstandingFailed };
