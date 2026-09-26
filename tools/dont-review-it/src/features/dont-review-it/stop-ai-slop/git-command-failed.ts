import { Schema } from "effect";

export class GitCommandFailed extends Schema.TaggedError<GitCommandFailed>()("GitCommandFailed", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}
