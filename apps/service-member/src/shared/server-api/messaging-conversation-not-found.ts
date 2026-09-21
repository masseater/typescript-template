import { Schema } from "effect";

class MessagingConversationNotFound extends Schema.TaggedError<MessagingConversationNotFound>()(
  "MessagingConversationNotFound",
  {},
) {}

export { MessagingConversationNotFound };
