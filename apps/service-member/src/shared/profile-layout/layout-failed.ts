import { Schema } from "effect";

class LayoutFailed extends Schema.TaggedError<LayoutFailed>()("LayoutFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["unavailable", "model_failed", "timed_out"]),
}) {}

export { LayoutFailed };
