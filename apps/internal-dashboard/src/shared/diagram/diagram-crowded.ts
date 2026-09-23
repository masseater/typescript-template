import { Schema } from "effect";

class DiagramCrowded extends Schema.TaggedError<DiagramCrowded>()("DiagramCrowded", {
  reason: Schema.String,
}) {}

export { DiagramCrowded };
