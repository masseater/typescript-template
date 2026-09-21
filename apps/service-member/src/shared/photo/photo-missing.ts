import { Schema } from "effect";

class PhotoMissing extends Schema.TaggedError<PhotoMissing>()("PhotoMissing", {}) {}

export { PhotoMissing };
