import { Schema } from "effect";

class ChatFailure extends Schema.TaggedError<ChatFailure>()("ChatFailure", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["state_invalid", "state_unwritable"]),
}) {}

export { ChatFailure };
