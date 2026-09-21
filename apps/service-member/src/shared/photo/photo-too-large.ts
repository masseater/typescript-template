import { Schema } from "effect";

class PhotoTooLarge extends Schema.TaggedError<PhotoTooLarge>()("PhotoTooLarge", {}) {}

export { PhotoTooLarge };
