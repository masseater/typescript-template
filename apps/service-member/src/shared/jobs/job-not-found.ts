import { Schema } from "effect";

class JobNotFound extends Schema.TaggedError<JobNotFound>()("JobNotFound", {}) {}

export { JobNotFound };
