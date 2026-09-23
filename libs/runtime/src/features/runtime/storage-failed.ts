import { Schema } from "effect";
class StorageFailed extends Schema.TaggedError<StorageFailed>()("StorageFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["unavailable", "operation_failed"]),
}) {}
export { StorageFailed };
