import { Schema } from "effect";

export class BlobUnreadable extends Schema.TaggedError<BlobUnreadable>()("BlobUnreadable", {
  message: Schema.String,
}) {}
