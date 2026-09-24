import { Data } from "effect";

class MessagingConversationNotFound extends Data.TaggedError("MessagingConversationNotFound") {}

export { MessagingConversationNotFound };
