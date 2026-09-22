import { Result, Schema } from "effect";

const OpenPullRequestFields = Schema.Struct({
  baseRefName: Schema.String,
  mergeStateStatus: Schema.String,
  number: Schema.Finite,
  url: Schema.String,
});

export type OpenPullRequest = typeof OpenPullRequestFields.Type;

export const parseOpenPullRequest = (printed: string): OpenPullRequest | undefined => {
  const decoded = Schema.decodeResult(Schema.fromJsonString(OpenPullRequestFields))(printed);
  return Result.isFailure(decoded) ? undefined : decoded.success;
};
