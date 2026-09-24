import { Schema } from "effect";

class GitHubAppKeyInvalid extends Schema.TaggedError<GitHubAppKeyInvalid>()("GitHubAppKeyInvalid", {
  cause: Schema.Defect(),
}) {}

export { GitHubAppKeyInvalid };
