import { Schema } from "effect";

class PhotoUnsupported extends Schema.TaggedError<PhotoUnsupported>()("PhotoUnsupported", {}) {}

export { PhotoUnsupported };
