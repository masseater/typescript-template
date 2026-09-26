import { Schema } from "effect";

export class MergeResolvedConflict extends Schema.TaggedError<MergeResolvedConflict>()(
  "MergeResolvedConflict",
  { file: Schema.String },
) {}
