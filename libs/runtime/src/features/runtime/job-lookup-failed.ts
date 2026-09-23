import { Schema } from "effect";

class JobLookupFailed extends Schema.TaggedError<JobLookupFailed>()("JobLookupFailed", {
  cause: Schema.Unknown,
}) {}

export { JobLookupFailed };
