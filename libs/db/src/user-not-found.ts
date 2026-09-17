import { Schema } from "effect";

class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {}) {}

export { UserNotFound };
