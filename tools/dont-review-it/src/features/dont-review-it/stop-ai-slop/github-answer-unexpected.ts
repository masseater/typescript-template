import { Schema } from "effect";

export class GitHubAnswerUnexpected extends Schema.TaggedError<GitHubAnswerUnexpected>()(
  "GitHubAnswerUnexpected",
  { message: Schema.String, cause: Schema.Defect() },
) {}
