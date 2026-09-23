import { Schema } from "effect";

class SpeakerPersonNotFound extends Schema.TaggedError<SpeakerPersonNotFound>()(
  "SpeakerPersonNotFound",
  {},
) {}

export { SpeakerPersonNotFound };
