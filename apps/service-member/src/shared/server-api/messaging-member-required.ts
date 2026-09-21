import { Schema } from "effect";

class MessagingMemberRequired extends Schema.TaggedError<MessagingMemberRequired>()(
  "MessagingMemberRequired",
  {},
) {}

export { MessagingMemberRequired };
