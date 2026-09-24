import { Schema } from "effect";

class NotificationNotFound extends Schema.TaggedError<NotificationNotFound>()(
  "NotificationNotFound",
  {},
) {}

export { NotificationNotFound };
