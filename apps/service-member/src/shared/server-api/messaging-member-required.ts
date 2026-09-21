import { Data } from "effect";

class MessagingMemberRequired extends Data.TaggedError("MessagingMemberRequired") {}

export { MessagingMemberRequired };
