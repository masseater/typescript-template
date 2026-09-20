import { Schema } from "effect";

class OperationForbidden extends Schema.TaggedError<OperationForbidden>()("OperationForbidden", {}) {}

export { OperationForbidden };
