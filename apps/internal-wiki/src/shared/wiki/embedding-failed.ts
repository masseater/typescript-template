import { Schema } from "effect";

class EmbeddingFailed extends Schema.TaggedError<EmbeddingFailed>()("EmbeddingFailed", {
  reason: Schema.Literals(["unavailable", "invalid_output", "count_mismatch"]),
}) {}

export { EmbeddingFailed };
