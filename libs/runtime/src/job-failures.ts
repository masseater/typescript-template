import { Schema } from "effect";

class JobNotFound extends Schema.TaggedError<JobNotFound>()("JobNotFound", {}) {}

class JobLookupFailed extends Schema.TaggedError<JobLookupFailed>()("JobLookupFailed", {
  cause: Schema.Unknown,
}) {}

export { JobLookupFailed, JobNotFound };
