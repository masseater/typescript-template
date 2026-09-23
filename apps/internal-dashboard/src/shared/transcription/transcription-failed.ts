import { transcriptionFailures } from "@repo/config";
import { Schema } from "effect";

class TranscriptionFailed extends Schema.TaggedError<TranscriptionFailed>()("TranscriptionFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(transcriptionFailures),
}) {}

export { TranscriptionFailed };
