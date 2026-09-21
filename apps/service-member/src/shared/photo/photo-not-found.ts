import { Schema } from "effect";

class PhotoNotFound extends Schema.TaggedError<PhotoNotFound>()("PhotoNotFound", {}) {}

export { PhotoNotFound };
