import { Schema } from "effect";

class RecordingNotFound extends Schema.TaggedError<RecordingNotFound>()("RecordingNotFound", {}) {}

export { RecordingNotFound };
