import { Schema } from "effect";

class RecordingQueueFailed extends Schema.TaggedError<RecordingQueueFailed>()(
  "RecordingQueueFailed",
  { cause: Schema.Defect() },
) {}

export { RecordingQueueFailed };
