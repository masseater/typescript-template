import { Schema } from "effect";

class RecordingNotRetryable extends Schema.TaggedError<RecordingNotRetryable>()(
  "RecordingNotRetryable",
  {},
) {}

export { RecordingNotRetryable };
