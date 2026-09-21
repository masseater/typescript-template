import { Schema } from "effect";

class PhotoStorageFailed extends Schema.TaggedError<PhotoStorageFailed>()("PhotoStorageFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["unavailable", "operation_failed"]),
}) {}

export { PhotoStorageFailed };
