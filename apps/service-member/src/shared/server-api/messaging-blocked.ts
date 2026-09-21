import { Schema } from "effect";

class MessagingBlocked extends Schema.TaggedError<MessagingBlocked>()("MessagingBlocked", {}) {}

export { MessagingBlocked };
