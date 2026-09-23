import { Schema } from "effect";

class RecordingAudioUnsupported extends Schema.TaggedError<RecordingAudioUnsupported>()(
  "RecordingAudioUnsupported",
  {},
) {}

export { RecordingAudioUnsupported };
